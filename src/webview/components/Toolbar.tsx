import React from 'react';
import { Trash2, Plug, Upload, ArrowUpDown, Terminal } from 'lucide-react';

interface ToolbarProps {
	onImport: (format: 'json' | 'ssh-config') => void;
	onSort: (criteria: 'name' | 'lastUsed' | 'group') => void;
	sortCriteria?: 'name' | 'lastUsed' | 'group';
	onQuickConnect: (connectionString: string) => void;
	selectedCount?: number;
	onBulkDelete?: () => void;
	onLocalTerminal?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
	onImport,
	onSort,
	sortCriteria,
	onQuickConnect,
	selectedCount = 0,
	onBulkDelete,
	onLocalTerminal
}) => {
	const [quickConnect, setQuickConnect] = React.useState('');

	const handleConnectClick = () => {
		if (quickConnect) {
			onQuickConnect(quickConnect);
			setQuickConnect('');
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleConnectClick();
		}
	};

	return (
		<div className="toolbar">
			{/* Bulk Actions (shown when hosts are selected) */}
			{selectedCount > 0 && (
				<div className="bulk-actions">
					<span className="selected-count">{selectedCount} selected</span>
					{onBulkDelete && (
						<button onClick={onBulkDelete} className="danger" title="Delete Selected">
							<Trash2 size={16} />
							Delete
						</button>
					)}
					<div className="toolbar-separator"></div>
				</div>
			)}

			{/* Quick Connect */}
			<div className="quick-connect">
				<input
					type="text"
					className="vscode-input"
					placeholder="user@host:port"
					value={quickConnect}
					onChange={e => setQuickConnect(e.target.value)}
					onKeyDown={handleKeyDown}
				/>
				<button onClick={handleConnectClick} title="Quick Connect">
					<Plug size={16} />
					Connect
				</button>
			</div>

			<div className="toolbar-separator"></div>

			<button onClick={() => onImport('json')} title="Import hosts from JSON file">
				<Upload size={16} />
				Import
			</button>

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

			{onLocalTerminal && (
				<>
					<div className="toolbar-separator"></div>
					<button onClick={onLocalTerminal} title="Open a local terminal">
						<Terminal size={16} />
						Terminal
					</button>
				</>
			)}
		</div>
	);
};

export default Toolbar;
