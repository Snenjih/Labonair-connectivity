// ============================================================================
// HOST STORE
// Zustand store for hosts, credentials, and session management
// ============================================================================

import { create } from 'zustand';
import { Host, Credential, HostStatus } from '../../common/types';

interface HostStore {
	// State
	hosts: Host[];
	credentials: Credential[];
	activeSessionHostIds: string[];
	hostStatuses: Record<string, HostStatus>;
	selectedHostIds: string[];
	sshAgentAvailable: boolean;
	availableShells: string[];

	// Actions
	setHosts: (hosts: Host[]) => void;
	setCredentials: (credentials: Credential[]) => void;
	setActiveSessionHostIds: (hostIds: string[]) => void;
	setHostStatuses: (statuses: Record<string, HostStatus>) => void;
	setSelectedHostIds: (hostIds: string[]) => void;
	setSshAgentAvailable: (available: boolean) => void;
	setAvailableShells: (shells: string[]) => void;

	// Selection helpers
	toggleHostSelection: (hostId: string) => void;
	clearSelection: () => void;
	selectAll: (hostIds: string[]) => void;

	// Computed values
	getHostById: (id: string) => Host | undefined;
	getSelectedHosts: () => Host[];
	isHostActive: (hostId: string) => boolean;
}

export const useHostStore = create<HostStore>((set, get) => ({
	// Initial state
	hosts: [],
	credentials: [],
	activeSessionHostIds: [],
	hostStatuses: {},
	selectedHostIds: [],
	sshAgentAvailable: false,
	availableShells: [],

	// Actions
	setHosts: (hosts) => set({ hosts }),
	setCredentials: (credentials) => set({ credentials }),
	setActiveSessionHostIds: (hostIds) => set({ activeSessionHostIds: hostIds }),
	setHostStatuses: (statuses) => set({ hostStatuses: statuses }),
	setSelectedHostIds: (hostIds) => set({ selectedHostIds: hostIds }),
	setSshAgentAvailable: (available) => set({ sshAgentAvailable: available }),
	setAvailableShells: (shells) => set({ availableShells: shells }),

	// Selection helpers
	toggleHostSelection: (hostId) => set((state) => {
		const selected = new Set(state.selectedHostIds);
		if (selected.has(hostId)) {
			selected.delete(hostId);
		} else {
			selected.add(hostId);
		}
		return { selectedHostIds: Array.from(selected) };
	}),

	clearSelection: () => set({ selectedHostIds: [] }),

	selectAll: (hostIds) => set({ selectedHostIds: hostIds }),

	// Computed values
	getHostById: (id) => {
		return get().hosts.find(h => h.id === id);
	},

	getSelectedHosts: () => {
		const { hosts, selectedHostIds } = get();
		return hosts.filter(h => selectedHostIds.includes(h.id));
	},

	isHostActive: (hostId) => {
		return get().activeSessionHostIds.includes(hostId);
	}
}));
