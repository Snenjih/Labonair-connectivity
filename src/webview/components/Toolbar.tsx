import React from 'react';
import { Trash2, ArrowUpDown, Terminal, X } from 'lucide-react';
import SplitButton from './SplitButton';

interface ToolbarProps {
	onAddHost: () => void;
	onImport: (format: 'json' | 'ssh-config') => void;
	onAddCredential: () => void;
	onSort: (criteria: 'name' | 'lastUsed' | 'group') => void;
	sortCriteria?: 'name' | 'lastUsed' | 'group';
	selectedCount?: number;
	onBulkDelete?: () => void;
	onClearSelection?: () => void;
	onLocalTerminal?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
	onAddHost,
	onImport,
	onAddCredential,
	onSort,
	sortCriteria,
	selectedCount = 0,
	onBulkDelete,
	onClearSelection,
	onLocalTerminal
}) => {
	return (
		<>
			<div className="toolbar">
				{/* Split Button for Add Actions */}
				<SplitButton
					onPrimaryClick={onAddHost}
					onImport={() => onImport('json')}
					onAddCredential={onAddCredential}
				/>

				{onLocalTerminal && (
					<>
						<div className="toolbar-separator"></div>
						<button onClick={onLocalTerminal} title="Open a local terminal">
							<Terminal size={16} />
							Local Terminal
						</button>
					</>
				)}

				<div className="toolbar-separator"></div>

				<div className="dropdown-wrapper">
					<ArrowUpDown size={16} style={{ color: 'var(--terminus-text-muted)', marginRight: '4px' }} />
					<select
						className="toolbar-select"
						onChange={(e) => onSort(e.target.value as 'name' | 'lastUsed' | 'group')}
						value={sortCriteria || 'name'}
					>
						<option value="name">Sort: Name</option>
						<option value="lastUsed">Sort: Last Used</option>
						<option value="group">Sort: Folder</option>
					</select>
				</div>
			</div>

			{/* Bulk Actions Bar - Phase 6.7Extend (shown when hosts are selected) */}
			{selectedCount > 0 && (
				<div className="bulk-actions-bar">
					<span className="selected-count">{selectedCount} host{selectedCount > 1 ? 's' : ''} selected</span>
					{onBulkDelete && (
						<button onClick={onBulkDelete} className="bulk-delete-btn" title="Delete Selected">
							<Trash2 size={16} />
							Delete
						</button>
					)}
					{onClearSelection && (
						<button onClick={onClearSelection} className="bulk-dismiss-btn" title="Clear Selection">
							<X size={16} />
							Done
						</button>
					)}
				</div>
			)}
		</>
	);
};

export default Toolbar;
