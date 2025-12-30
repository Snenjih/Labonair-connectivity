// ============================================================================
// FILE STORE
// Zustand store for file manager state (panels, files, selections)
// ============================================================================

import { create } from 'zustand';
import { FileEntry, Bookmark, DiskSpaceInfo } from '../../common/types';

interface PanelState {
	system: 'local' | 'remote';
	path: string;
	files: FileEntry[];
	selectedFiles: FileEntry[];
	loading: boolean;
	error?: string;
}

interface FileStore {
	// State
	activePanel: 'left' | 'right';
	leftPanel: PanelState;
	rightPanel: PanelState;
	layoutMode: 'explorer' | 'commander';
	viewMode: 'list' | 'grid';
	bookmarks: Bookmark[];
	diskSpace: {
		local?: DiskSpaceInfo;
		remote?: DiskSpaceInfo;
	};

	// Actions - Panel Management
	setActivePanel: (panel: 'left' | 'right') => void;
	setLayoutMode: (mode: 'explorer' | 'commander') => void;
	setViewMode: (mode: 'list' | 'grid') => void;

	// Actions - Left Panel
	setLeftPath: (path: string) => void;
	setLeftFiles: (files: FileEntry[]) => void;
	setLeftSystem: (system: 'local' | 'remote') => void;
	setLeftLoading: (loading: boolean) => void;
	setLeftError: (error?: string) => void;
	setLeftSelection: (files: FileEntry[]) => void;
	toggleLeftFileSelection: (file: FileEntry) => void;
	clearLeftSelection: () => void;

	// Actions - Right Panel
	setRightPath: (path: string) => void;
	setRightFiles: (files: FileEntry[]) => void;
	setRightSystem: (system: 'local' | 'remote') => void;
	setRightLoading: (loading: boolean) => void;
	setRightError: (error?: string) => void;
	setRightSelection: (files: FileEntry[]) => void;
	toggleRightFileSelection: (file: FileEntry) => void;
	clearRightSelection: () => void;

	// Actions - Bookmarks
	setBookmarks: (bookmarks: Bookmark[]) => void;
	addBookmark: (bookmark: Bookmark) => void;
	removeBookmark: (bookmarkId: string) => void;

	// Actions - Disk Space
	setLocalDiskSpace: (space: DiskSpaceInfo) => void;
	setRemoteDiskSpace: (space: DiskSpaceInfo) => void;

	// Computed values
	getActivePanel: () => PanelState;
	getInactivePanel: () => PanelState;
}

const initialPanelState: PanelState = {
	system: 'local',
	path: '',
	files: [],
	selectedFiles: [],
	loading: false,
	error: undefined
};

export const useFileStore = create<FileStore>((set, get) => ({
	// Initial state
	activePanel: 'left',
	leftPanel: { ...initialPanelState },
	rightPanel: { ...initialPanelState },
	layoutMode: 'explorer',
	viewMode: 'list',
	bookmarks: [],
	diskSpace: {},

	// Panel Management
	setActivePanel: (panel) => set({ activePanel: panel }),
	setLayoutMode: (mode) => set({ layoutMode: mode }),
	setViewMode: (mode) => set({ viewMode: mode }),

	// Left Panel
	setLeftPath: (path) => set((state) => ({
		leftPanel: { ...state.leftPanel, path }
	})),
	setLeftFiles: (files) => set((state) => ({
		leftPanel: { ...state.leftPanel, files }
	})),
	setLeftSystem: (system) => set((state) => ({
		leftPanel: { ...state.leftPanel, system }
	})),
	setLeftLoading: (loading) => set((state) => ({
		leftPanel: { ...state.leftPanel, loading }
	})),
	setLeftError: (error) => set((state) => ({
		leftPanel: { ...state.leftPanel, error }
	})),
	setLeftSelection: (files) => set((state) => ({
		leftPanel: { ...state.leftPanel, selectedFiles: files }
	})),
	toggleLeftFileSelection: (file) => set((state) => {
		const selected = state.leftPanel.selectedFiles.find(f => f.path === file.path);
		const newSelection = selected
			? state.leftPanel.selectedFiles.filter(f => f.path !== file.path)
			: [...state.leftPanel.selectedFiles, file];
		return {
			leftPanel: { ...state.leftPanel, selectedFiles: newSelection }
		};
	}),
	clearLeftSelection: () => set((state) => ({
		leftPanel: { ...state.leftPanel, selectedFiles: [] }
	})),

	// Right Panel
	setRightPath: (path) => set((state) => ({
		rightPanel: { ...state.rightPanel, path }
	})),
	setRightFiles: (files) => set((state) => ({
		rightPanel: { ...state.rightPanel, files }
	})),
	setRightSystem: (system) => set((state) => ({
		rightPanel: { ...state.rightPanel, system }
	})),
	setRightLoading: (loading) => set((state) => ({
		rightPanel: { ...state.rightPanel, loading }
	})),
	setRightError: (error) => set((state) => ({
		rightPanel: { ...state.rightPanel, error }
	})),
	setRightSelection: (files) => set((state) => ({
		rightPanel: { ...state.rightPanel, selectedFiles: files }
	})),
	toggleRightFileSelection: (file) => set((state) => {
		const selected = state.rightPanel.selectedFiles.find(f => f.path === file.path);
		const newSelection = selected
			? state.rightPanel.selectedFiles.filter(f => f.path !== file.path)
			: [...state.rightPanel.selectedFiles, file];
		return {
			rightPanel: { ...state.rightPanel, selectedFiles: newSelection }
		};
	}),
	clearRightSelection: () => set((state) => ({
		rightPanel: { ...state.rightPanel, selectedFiles: [] }
	})),

	// Bookmarks
	setBookmarks: (bookmarks) => set({ bookmarks }),
	addBookmark: (bookmark) => set((state) => ({
		bookmarks: [...state.bookmarks, bookmark]
	})),
	removeBookmark: (bookmarkId) => set((state) => ({
		bookmarks: state.bookmarks.filter(b => b.id !== bookmarkId)
	})),

	// Disk Space
	setLocalDiskSpace: (space) => set((state) => ({
		diskSpace: { ...state.diskSpace, local: space }
	})),
	setRemoteDiskSpace: (space) => set((state) => ({
		diskSpace: { ...state.diskSpace, remote: space }
	})),

	// Computed values
	getActivePanel: () => {
		const { activePanel, leftPanel, rightPanel } = get();
		return activePanel === 'left' ? leftPanel : rightPanel;
	},
	getInactivePanel: () => {
		const { activePanel, leftPanel, rightPanel } = get();
		return activePanel === 'left' ? rightPanel : leftPanel;
	}
}));
