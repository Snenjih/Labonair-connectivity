// ============================================================================
// FRONTEND RPC CLIENT
// Type-safe RPC client for making requests from webview to extension
// ============================================================================

import {
	RpcRequest,
	RpcResponse,
	RpcProtocol,
	RpcParams,
	RpcResult,
	RpcErrorCode
} from '../../common/rpc';
import { v4 as uuid } from 'uuid';

/**
 * VS Code API for posting messages
 */
declare function acquireVsCodeApi(): {
	postMessage(message: any): void;
	getState(): any;
	setState(state: any): void;
};

const vscode = acquireVsCodeApi();

/**
 * Pending RPC request
 */
interface PendingRequest {
	resolve: (value: any) => void;
	reject: (error: Error) => void;
	method: string;
	timeout?: NodeJS.Timeout;
}

/**
 * RPC Client
 * Manages request/response lifecycle for type-safe RPC calls
 */
export class RpcClient {
	private pendingRequests: Map<string, PendingRequest> = new Map();
	private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

	constructor() {
		this.setupMessageListener();
	}

	/**
	 * Makes a type-safe RPC request
	 */
	public request<K extends keyof RpcProtocol>(
		method: K,
		params: RpcParams<K>,
		timeout?: number
	): Promise<RpcResult<K>> {
		const id = uuid();
		const request: RpcRequest = {
			id,
			method: method as string,
			params
		};

		return new Promise((resolve, reject) => {
			// Set up timeout
			const timeoutMs = timeout || this.DEFAULT_TIMEOUT;
			const timeoutHandle = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(new Error(`RPC request timeout after ${timeoutMs}ms: ${method}`));
			}, timeoutMs);

			// Store pending request
			this.pendingRequests.set(id, {
				resolve,
				reject,
				method: method as string,
				timeout: timeoutHandle
			});

			// Send request to extension
			vscode.postMessage({
				type: 'rpc-request',
				request
			});
		});
	}

	/**
	 * Sets up message listener for RPC responses
	 */
	private setupMessageListener(): void {
		window.addEventListener('message', (event) => {
			const message = event.data;

			// Handle RPC responses
			if (message.type === 'rpc-response') {
				this.handleResponse(message.response);
			}
		});
	}

	/**
	 * Handles RPC response from extension
	 */
	private handleResponse(response: RpcResponse): void {
		const pending = this.pendingRequests.get(response.id);
		if (!pending) {
			console.warn('[RPC] Received response for unknown request:', response.id);
			return;
		}

		// Clear timeout
		if (pending.timeout) {
			clearTimeout(pending.timeout);
		}

		// Remove from pending
		this.pendingRequests.delete(response.id);

		// Resolve or reject
		if (response.error) {
			const error = new Error(response.error.message);
			(error as any).code = response.error.code;
			(error as any).data = response.error.data;
			pending.reject(error);
		} else {
			pending.resolve(response.result);
		}
	}

	/**
	 * Cancels all pending requests
	 */
	public cancelAll(): void {
		for (const [id, pending] of this.pendingRequests.entries()) {
			if (pending.timeout) {
				clearTimeout(pending.timeout);
			}
			pending.reject(new Error('Request cancelled'));
		}
		this.pendingRequests.clear();
	}

	/**
	 * Gets the number of pending requests
	 */
	public getPendingCount(): number {
		return this.pendingRequests.size;
	}
}

// Create and export singleton instance
export const rpcClient = new RpcClient();

/**
 * Convenience function for making RPC requests
 */
export function rpc<K extends keyof RpcProtocol>(
	method: K,
	params: RpcParams<K>,
	timeout?: number
): Promise<RpcResult<K>> {
	return rpcClient.request(method, params, timeout);
}
