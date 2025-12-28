import * as vscode from 'vscode';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { TransferJob, UploadJob, DownloadJob, TransferJobStatus, TransferQueueSummary } from '../../common/types';
import { SftpService } from './sftpService';

/**
 * Priority Queue for managing transfer jobs
 * Jobs with higher priority values are processed first
 */
class TransferQueue {
	private queue: TransferJob[] = [];

	/**
	 * Adds a job to the queue
	 */
	public enqueue(job: TransferJob): void {
		this.queue.push(job);
		// Sort by priority (descending) and creation time (ascending)
		this.queue.sort((a, b) => {
			if (b.priority !== a.priority) {
				return b.priority - a.priority;
			}
			return a.createdAt - b.createdAt;
		});
	}

	/**
	 * Removes and returns the highest priority job
	 */
	public dequeue(): TransferJob | undefined {
		return this.queue.shift();
	}

	/**
	 * Returns the next job without removing it
	 */
	public peek(): TransferJob | undefined {
		return this.queue[0];
	}

	/**
	 * Returns all jobs in the queue
	 */
	public getAll(): TransferJob[] {
		return [...this.queue];
	}

	/**
	 * Finds a job by ID
	 */
	public findById(jobId: string): TransferJob | undefined {
		return this.queue.find(j => j.id === jobId);
	}

	/**
	 * Removes a job by ID
	 */
	public removeById(jobId: string): boolean {
		const index = this.queue.findIndex(j => j.id === jobId);
		if (index !== -1) {
			this.queue.splice(index, 1);
			return true;
		}
		return false;
	}

	/**
	 * Returns the number of jobs in the queue
	 */
	public get size(): number {
		return this.queue.length;
	}

	/**
	 * Clears all jobs from the queue
	 */
	public clear(): void {
		this.queue = [];
	}

	/**
	 * Gets all jobs with a specific status
	 */
	public getByStatus(status: TransferJobStatus): TransferJob[] {
		return this.queue.filter(j => j.status === status);
	}
}

/**
 * Transfer Service
 * Manages background file uploads/downloads asynchronously
 * Supports concurrent transfers with queue management
 */
export class TransferService {
	private queue: TransferQueue = new TransferQueue();
	private activeTransfers: Map<string, { job: TransferJob; abortController?: AbortController }> = new Map();
	private completedJobs: TransferJob[] = [];
	private readonly maxConcurrentTransfersPerHost: number = 3;
	private readonly maxConcurrentTransfersGlobal: number = 5;
	private processingInterval: NodeJS.Timeout | null = null;

	constructor(
		private readonly sftpService: SftpService,
		private readonly onUpdate: (job: TransferJob) => void,
		private readonly onQueueChange: (jobs: TransferJob[], summary: TransferQueueSummary) => void
	) {
		// Start processing queue
		this.startProcessing();
	}

	/**
	 * Adds a new transfer job to the queue
	 */
	public addJob(jobData: Partial<TransferJob>): TransferJob {
		const job: TransferJob = {
			id: jobData.id || uuidv4(),
			type: jobData.type || 'download',
			hostId: jobData.hostId!,
			filename: jobData.filename!,
			size: jobData.size || 0,
			status: 'pending',
			progress: 0,
			speed: 0,
			bytesTransferred: 0,
			priority: jobData.priority || 1,
			createdAt: Date.now(),
			...(jobData.type === 'upload' ? {
				localPath: (jobData as Partial<UploadJob>).localPath!,
				remotePath: (jobData as Partial<UploadJob>).remotePath!
			} : {
				remotePath: (jobData as Partial<DownloadJob>).remotePath!,
				localPath: (jobData as Partial<DownloadJob>).localPath!
			})
		} as TransferJob;

		this.queue.enqueue(job);
		this.notifyQueueChange();
		return job;
	}

	/**
	 * Pauses a transfer job
	 */
	public pauseJob(jobId: string): boolean {
		const activeTransfer = this.activeTransfers.get(jobId);
		if (activeTransfer) {
			activeTransfer.abortController?.abort();
			activeTransfer.job.status = 'paused';
			this.activeTransfers.delete(jobId);
			this.queue.enqueue(activeTransfer.job);
			this.notifyJobUpdate(activeTransfer.job);
			this.notifyQueueChange();
			return true;
		}

		const queuedJob = this.queue.findById(jobId);
		if (queuedJob) {
			queuedJob.status = 'paused';
			this.notifyJobUpdate(queuedJob);
			this.notifyQueueChange();
			return true;
		}

		return false;
	}

	/**
	 * Resumes a paused transfer job
	 */
	public resumeJob(jobId: string): boolean {
		const job = this.queue.findById(jobId);
		if (job && job.status === 'paused') {
			job.status = 'pending';
			this.notifyJobUpdate(job);
			this.notifyQueueChange();
			return true;
		}
		return false;
	}

	/**
	 * Cancels a transfer job
	 */
	public cancelJob(jobId: string): boolean {
		// Cancel active transfer
		const activeTransfer = this.activeTransfers.get(jobId);
		if (activeTransfer) {
			activeTransfer.abortController?.abort();
			activeTransfer.job.status = 'cancelled';
			this.activeTransfers.delete(jobId);
			this.completedJobs.push(activeTransfer.job);
			this.notifyJobUpdate(activeTransfer.job);
			this.notifyQueueChange();
			return true;
		}

		// Cancel queued transfer
		const queuedJob = this.queue.findById(jobId);
		if (queuedJob) {
			queuedJob.status = 'cancelled';
			this.queue.removeById(jobId);
			this.completedJobs.push(queuedJob);
			this.notifyJobUpdate(queuedJob);
			this.notifyQueueChange();
			return true;
		}

		return false;
	}

	/**
	 * Clears all completed jobs
	 */
	public clearCompleted(): void {
		this.completedJobs = this.completedJobs.filter(
			j => j.status === 'active' || j.status === 'pending' || j.status === 'paused'
		);
		this.notifyQueueChange();
	}

	/**
	 * Gets all jobs (queued + active + completed)
	 */
	public getAllJobs(): TransferJob[] {
		const queuedJobs = this.queue.getAll();
		const activeJobs = Array.from(this.activeTransfers.values()).map(t => t.job);
		return [...queuedJobs, ...activeJobs, ...this.completedJobs];
	}

	/**
	 * Gets queue summary
	 */
	public getSummary(): TransferQueueSummary {
		const activeJobs = Array.from(this.activeTransfers.values()).map(t => t.job);
		const totalSpeed = activeJobs.reduce((sum, job) => sum + job.speed, 0);

		return {
			activeCount: activeJobs.length,
			totalSpeed,
			queuedCount: this.queue.size
		};
	}

	/**
	 * Starts processing the transfer queue
	 */
	private startProcessing(): void {
		if (this.processingInterval) {
			return;
		}

		this.processingInterval = setInterval(() => {
			this.processQueue();
		}, 1000);
	}

	/**
	 * Processes the queue and starts pending transfers
	 */
	private async processQueue(): Promise<void> {
		// Check global concurrency limit
		if (this.activeTransfers.size >= this.maxConcurrentTransfersGlobal) {
			return;
		}

		// Get next pending job
		const nextJob = this.queue.peek();
		if (!nextJob || nextJob.status !== 'pending') {
			return;
		}

		// Check per-host concurrency limit
		const activeTransfersForHost = Array.from(this.activeTransfers.values())
			.filter(t => t.job.hostId === nextJob.hostId);

		if (activeTransfersForHost.length >= this.maxConcurrentTransfersPerHost) {
			return;
		}

		// Dequeue and start transfer
		this.queue.dequeue();
		await this.startTransfer(nextJob);
	}

	/**
	 * Starts a transfer job
	 */
	private async startTransfer(job: TransferJob): Promise<void> {
		job.status = 'active';
		job.startedAt = Date.now();

		const abortController = new AbortController();
		this.activeTransfers.set(job.id, { job, abortController });
		this.notifyJobUpdate(job);
		this.notifyQueueChange();

		try {
			if (job.type === 'upload') {
				await this.performUpload(job);
			} else {
				await this.performDownload(job);
			}

			// Transfer completed successfully
			job.status = 'completed';
			job.completedAt = Date.now();
			job.progress = 100;
		} catch (error: any) {
			// Transfer failed
			if (error.name === 'AbortError' || abortController.signal.aborted) {
				// Job was cancelled or paused - already handled
				return;
			}

			job.status = 'error';
			job.error = error.message || 'Unknown error';
			job.completedAt = Date.now();
		} finally {
			// Move to completed and remove from active
			this.activeTransfers.delete(job.id);
			this.completedJobs.push(job);
			this.notifyJobUpdate(job);
			this.notifyQueueChange();
		}
	}

	/**
	 * Performs an upload transfer
	 */
	private async performUpload(job: UploadJob): Promise<void> {
		const stats = fs.statSync(job.localPath);
		job.size = stats.size;

		await this.sftpService.putFile(
			job.hostId,
			job.localPath,
			job.remotePath,
			(progress, speed) => {
				job.progress = progress;
				job.speed = this.parseSpeed(speed);
				job.bytesTransferred = Math.round((progress / 100) * job.size);
				this.notifyJobUpdate(job);
			}
		);
	}

	/**
	 * Performs a download transfer
	 */
	private async performDownload(job: DownloadJob): Promise<void> {
		await this.sftpService.getFile(
			job.hostId,
			job.remotePath,
			job.localPath,
			(progress, speed) => {
				job.progress = progress;
				job.speed = this.parseSpeed(speed);
				job.bytesTransferred = Math.round((progress / 100) * job.size);
				this.notifyJobUpdate(job);
			}
		);
	}

	/**
	 * Parses speed string to bytes per second
	 */
	private parseSpeed(speedStr: string): number {
		const match = speedStr.match(/([\d.]+)\s*(B|KB|MB|GB)\/s/i);
		if (!match) {
			return 0;
		}

		const value = parseFloat(match[1]);
		const unit = match[2].toUpperCase();

		switch (unit) {
			case 'B': return value;
			case 'KB': return value * 1024;
			case 'MB': return value * 1024 * 1024;
			case 'GB': return value * 1024 * 1024 * 1024;
			default: return value;
		}
	}

	/**
	 * Notifies listeners about job update
	 */
	private notifyJobUpdate(job: TransferJob): void {
		this.onUpdate(job);
	}

	/**
	 * Notifies listeners about queue change
	 */
	private notifyQueueChange(): void {
		const jobs = this.getAllJobs();
		const summary = this.getSummary();
		this.onQueueChange(jobs, summary);
	}

	/**
	 * Disposes the transfer service
	 */
	public dispose(): void {
		if (this.processingInterval) {
			clearInterval(this.processingInterval);
			this.processingInterval = null;
		}

		// Cancel all active transfers
		for (const transfer of this.activeTransfers.values()) {
			transfer.abortController?.abort();
		}

		this.activeTransfers.clear();
		this.queue.clear();
		this.completedJobs = [];
	}
}
