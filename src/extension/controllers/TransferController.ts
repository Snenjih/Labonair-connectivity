// ============================================================================
// TRANSFER CONTROLLER
// Handles all transfer queue operations
// ============================================================================

import * as vscode from 'vscode';
import { BaseController } from './BaseController';
import { TransferService } from '../services/transferService';
import { TransferJob, TransferQueueSummary } from '../../common/types';

/**
 * Transfer Controller
 * Manages file transfer queue operations
 */
export class TransferController extends BaseController {
	constructor(
		context: vscode.ExtensionContext,
		private readonly transferService: TransferService
	) {
		super(context);
	}

	/**
	 * Adds a job to the transfer queue
	 */
	async addJob(job: Partial<TransferJob>): Promise<void> {
		this.transferService.addJob(job as TransferJob);
		this.log(`Transfer job added: ${job.filename}`);
	}

	/**
	 * Pauses a transfer job
	 */
	async pauseJob(jobId: string): Promise<void> {
		this.transferService.pauseJob(jobId);
		this.log(`Transfer job paused: ${jobId}`);
	}

	/**
	 * Resumes a transfer job
	 */
	async resumeJob(jobId: string): Promise<void> {
		this.transferService.resumeJob(jobId);
		this.log(`Transfer job resumed: ${jobId}`);
	}

	/**
	 * Cancels a transfer job
	 */
	async cancelJob(jobId: string): Promise<void> {
		this.transferService.cancelJob(jobId);
		this.log(`Transfer job cancelled: ${jobId}`);
	}

	/**
	 * Clears completed transfer jobs
	 */
	async clearCompleted(): Promise<void> {
		this.transferService.clearCompleted();
		this.log('Cleared completed transfer jobs');
	}

	/**
	 * Gets all transfer jobs and summary
	 */
	async getAllJobs(): Promise<{ jobs: TransferJob[]; summary: TransferQueueSummary }> {
		const jobs = this.transferService.getAllJobs();
		const summary = this.transferService.getSummary();
		return { jobs, summary };
	}

	/**
	 * Resolves a transfer conflict
	 */
	async resolveConflict(
		transferId: string,
		action: 'overwrite' | 'resume' | 'rename' | 'skip',
		applyToAll?: boolean
	): Promise<void> {
		this.transferService.resolveConflict(transferId, action);
		this.log(`Transfer conflict resolved: ${transferId} -> ${action}`);
	}
}
