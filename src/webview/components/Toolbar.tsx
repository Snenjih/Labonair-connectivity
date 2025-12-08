import React from 'react';

interface ToolbarProps {
	onRefresh: () => void;
	onImport: (format: 'json' | 'ssh-config') => void;
	onExport: () => void;
	onSort: (criteria: 'name' | 'lastUsed' | 'group') => void;
	sortCriteria?: 'name' | 'lastUsed' | 'group';
	onQuickConnect: (connectionString: string) => void;
	selectedCount?: number;
	onBulkDelete?: () => void;
	onBulkExport?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
	onRefresh,
	onImport,
	onExport,
	onSort,
	sortCriteria,
	onQuickConnect,
	selectedCount = 0,
	onBulkDelete,
	onBulkExport
}) => {
	const handleImportClick = () => {
		onImport('ssh-config');
	};

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
					{onBulkExport && (
						<button onClick={onBulkExport} title="Export Selected">
							<i className="codicon codicon-cloud-download"></i>
						</button>
					)}
					{onBulkDelete && (
						<button onClick={onBulkDelete} title="Delete Selected" className="danger">
							<i className="codicon codicon-trash"></i>
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
				</button>
			</div>

			<div className="toolbar-separator"></div>

			<button onClick={onRefresh} title="Refresh">
				<i className="codicon codicon-refresh"></i>
			</button>
			<button onClick={handleImportClick} title="Import SSH Config">
				<i className="codicon codicon-cloud-upload"></i>
			</button>
			<button onClick={onExport} title="Export JSON">
				<i className="codicon codicon-cloud-download"></i>
			</button>

			<div className="toolbar-separator"></div>

			<div className="dropdown-wrapper">
				<i className="codicon codicon-sort-precedence dropdown-icon"></i>
				<select
					className="toolbar-select"
					onChange={(e) => onSort(e.target.value as 'name' | 'lastUsed' | 'group')}
					value={sortCriteria || 'name'}
				>
					<option value="name">Name</option>
					<option value="lastUsed">Last Used</option>
					<option value="group">Folder</option>
				</select>
			</div>

			<div className="toolbar-separator"></div>

			<button title="Local Terminal">
				<i className="codicon codicon-terminal"></i>
			</button>
		</div>
	);
};

export default Toolbar;

