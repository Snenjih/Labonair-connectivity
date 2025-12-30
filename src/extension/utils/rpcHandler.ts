// ============================================================================
// BACKEND RPC HANDLER
// Handles RPC requests from webview and routes to controllers
// ============================================================================

import * as vscode from 'vscode';
import {
	RpcRequest,
	RpcResponse,
	RpcProtocol,
	RpcErrorCode
} from '../../common/rpc';

/**
 * RPC Handler function type
 */
export type RpcHandler<K extends keyof RpcProtocol> = (
	params: RpcProtocol[K]['params']
) => Promise<RpcProtocol[K]['result']> | RpcProtocol[K]['result'];

/**
 * RPC Router
 * Routes RPC requests to registered handlers
 */
export class RpcRouter {
	private handlers: Map<string, RpcHandler<any>> = new Map();
	private webview?: vscode.Webview;

	/**
	 * Sets the webview for sending responses
	 */
	public setWebview(webview: vscode.Webview): void {
		this.webview = webview;
	}

	/**
	 * Registers an RPC handler for a specific method
	 */
	public register<K extends keyof RpcProtocol>(
		method: K,
		handler: RpcHandler<K>
	): void {
		this.handlers.set(method as string, handler);
	}

	/**
	 * Unregisters an RPC handler
	 */
	public unregister(method: keyof RpcProtocol): void {
		this.handlers.delete(method as string);
	}

	/**
	 * Handles an incoming RPC request
	 */
	public async handleRequest(request: RpcRequest): Promise<void> {
		const response: RpcResponse = {
			id: request.id,
			result: undefined,
			error: undefined
		};

		try {
			// Get handler
			const handler = this.handlers.get(request.method);
			if (!handler) {
				response.error = {
					code: RpcErrorCode.METHOD_NOT_FOUND,
					message: `Method not found: ${request.method}`
				};
			} else {
				// Execute handler
				try {
					const result = await handler(request.params);
					response.result = result;
				} catch (error: any) {
					// Map known errors to RPC error codes
					const errorCode = this.mapErrorCode(error);
					response.error = {
						code: errorCode,
						message: error.message || 'Operation failed',
						data: error.stack
					};

					// Show error toast to user for certain error types
					if (this.shouldShowErrorToast(errorCode)) {
						vscode.window.showErrorMessage(`${request.method}: ${error.message}`);
					}
				}
			}
		} catch (error: any) {
			// Unexpected error in router
			response.error = {
				code: RpcErrorCode.INTERNAL_ERROR,
				message: error.message || 'Internal error',
				data: error.stack
			};
			console.error('[RPC Router] Internal error:', error);
		}

		// Send response back to webview
		this.sendResponse(response);
	}

	/**
	 * Sends an RPC response to the webview
	 */
	private sendResponse(response: RpcResponse): void {
		if (!this.webview) {
			console.error('[RPC Router] No webview set, cannot send response');
			return;
		}

		this.webview.postMessage({
			type: 'rpc-response',
			response
		});
	}

	/**
	 * Maps JavaScript errors to RPC error codes
	 */
	private mapErrorCode(error: any): number {
		const message = error.message?.toLowerCase() || '';

		if (message.includes('not found')) {
			if (message.includes('host')) {
				return RpcErrorCode.HOST_NOT_FOUND;
			} else if (message.includes('credential')) {
				return RpcErrorCode.CREDENTIAL_NOT_FOUND;
			} else if (message.includes('file')) {
				return RpcErrorCode.FILE_NOT_FOUND;
			}
		}

		if (message.includes('permission') || message.includes('denied') || message.includes('eacces')) {
			return RpcErrorCode.PERMISSION_DENIED;
		}

		if (message.includes('connect') || message.includes('connection')) {
			return RpcErrorCode.CONNECTION_FAILED;
		}

		// Default to operation failed
		return RpcErrorCode.OPERATION_FAILED;
	}

	/**
	 * Determines if an error should show a toast notification
	 */
	private shouldShowErrorToast(errorCode: number): boolean {
		// Don't show toasts for common errors that are handled in the UI
		const silentErrors = [
			RpcErrorCode.FILE_NOT_FOUND,
			RpcErrorCode.METHOD_NOT_FOUND
		];

		return !silentErrors.includes(errorCode);
	}

	/**
	 * Gets all registered method names
	 */
	public getRegisteredMethods(): string[] {
		return Array.from(this.handlers.keys());
	}

	/**
	 * Clears all registered handlers
	 */
	public clear(): void {
		this.handlers.clear();
	}
}
