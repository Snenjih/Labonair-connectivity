// ============================================================================
// TRANSFER STORE
// Zustand store for transfer queue state (high update frequency)
// ============================================================================

import { create } from 'zustand';
import { TransferJob, TransferQueueSummary } from '../../common/types';

interface TransferStore {
	// State
	jobs: TransferJob[];
	summary: TransferQueueSummary;

	// Actions
	setJobs: (jobs: TransferJob[]) => void;
	setSummary: (summary: TransferQueueSummary) => void;
	updateJob: (job: TransferJob) => void;
	addJob: (job: TransferJob) => void;
	removeJob: (jobId: string) => void;
	clearCompleted: () => void;

	// Computed values
	getJobById: (id: string) => TransferJob | undefined;
	getActiveJobs: () => TransferJob[];
	getCompletedJobs: () => TransferJob[];
	getPendingJobs: () => TransferJob[];
}

export const useTransferStore = create<TransferStore>((set, get) => ({
	// Initial state
	jobs: [],
	summary: {
		activeCount: 0,
		totalSpeed: 0,
		queuedCount: 0
	},

	// Actions
	setJobs: (jobs) => set({ jobs }),

	setSummary: (summary) => set({ summary }),

	updateJob: (job) => set((state) => ({
		jobs: state.jobs.map(j => j.id === job.id ? job : j)
	})),

	addJob: (job) => set((state) => ({
		jobs: [...state.jobs, job]
	})),

	removeJob: (jobId) => set((state) => ({
		jobs: state.jobs.filter(j => j.id !== jobId)
	})),

	clearCompleted: () => set((state) => ({
		jobs: state.jobs.filter(j => j.status !== 'completed' && j.status !== 'error' && j.status !== 'cancelled')
	})),

	// Computed values
	getJobById: (id) => {
		return get().jobs.find(j => j.id === id);
	},

	getActiveJobs: () => {
		return get().jobs.filter(j => j.status === 'active');
	},

	getCompletedJobs: () => {
		return get().jobs.filter(j => j.status === 'completed' || j.status === 'error' || j.status === 'cancelled');
	},

	getPendingJobs: () => {
		return get().jobs.filter(j => j.status === 'pending');
	}
}));
