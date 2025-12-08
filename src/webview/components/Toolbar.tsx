import React from 'react';

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
							<i className="codicon codicon-trash"></i>
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
					<i className="codicon codicon-plug"></i>
					Connect
				</button>
			</div>

			<div className="toolbar-separator"></div>

			<button onClick={() => onImport('json')} title="Import hosts from JSON file">
				<i className="codicon codicon-cloud-upload"></i>
				Import
			</button>

			<div className="toolbar-separator"></div>

			<div className="dropdown-wrapper">
				<i className="codicon codicon-sort-precedence dropdown-icon"></i>
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
						<i className="codicon codicon-terminal"></i>
						Terminal
					</button>
				</>
			)}
		</div>
	);
};

export default Toolbar;
