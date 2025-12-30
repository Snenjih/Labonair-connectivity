// ============================================================================
// CREDENTIAL CONTROLLER
// Handles all credential-related operations
// ============================================================================

import * as vscode from 'vscode';
import { BaseController } from './BaseController';
import { CredentialService } from '../credentialService';
import { Credential } from '../../common/types';

/**
 * Credential Controller
 * Manages credential CRUD operations
 */
export class CredentialController extends BaseController {
	constructor(
		context: vscode.ExtensionContext,
		private readonly credentialService: CredentialService
	) {
		super(context);
	}

	/**
	 * Lists all credentials
	 */
	async listCredentials(): Promise<Credential[]> {
		return await this.credentialService.getCredentials();
	}

	/**
	 * Saves a credential
	 */
	async saveCredential(credential: Credential, secret: string): Promise<void> {
		await this.credentialService.saveCredential(credential, secret);
		this.log(`Credential saved: ${credential.name}`);
	}

	/**
	 * Deletes a credential
	 */
	async deleteCredential(id: string): Promise<void> {
		await this.credentialService.deleteCredential(id);
		this.log(`Credential deleted: ${id}`);
	}
}
