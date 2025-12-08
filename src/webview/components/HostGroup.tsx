import React, { useState, useMemo } from 'react';
import { Credential } from '../../common/types';
import vscode from '../utils/vscode';

interface HostGroupProps {
	name: string;
	count: number;
	credentials?: Credential[];
	children: React.ReactNode;
	selectedHostIds?: string[];
	onSelectAll?: (selected: boolean) => void;
	onRenameFolder?: (oldName: string, newName: string) => void;
}

const HostGroup: React.FC<HostGroupProps> = ({
	name,
	count,
	credentials = [],
	children,
	selectedHostIds = [],
	onSelectAll,
	onRenameFolder
}) => {
	const [isOpen, setIsOpen] = useState(true);
	const [showSettings, setShowSettings] = useState(false);
	const [isRenaming, setIsRenaming] = useState(false);
	const [newName, setNewName] = useState(name);
	const [config, setConfig] = useState<{ username?: string, port?: number, credentialId?: string }>({});

	const toggleOpen = () => setIsOpen(!isOpen);

	// Check if all hosts in this group are selected
	const allSelected = useMemo(() => {
		// This is a simplified check - in real implementation we'd need host IDs
		return false; // Placeholder
	}, [selectedHostIds]);

	const handleSettingsClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setShowSettings(true);
	};

	const handleRenameClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setNewName(name);
		setIsRenaming(true);
	};

	const handleRenameSubmit = () => {
		if (newName && newName !== name && onRenameFolder) {
			onRenameFolder(name, newName);
		}
		setIsRenaming(false);
	};

	const handleRenameKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleRenameSubmit();
		} else if (e.key === 'Escape') {
			setIsRenaming(false);
		}
	};

	const handleSelectAllClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onSelectAll) {
			onSelectAll(!allSelected);
		}
	};

	const handleSaveSettings = () => {
		vscode.postMessage({
			command: 'SAVE_FOLDER_CONFIG',
			payload: {
				config: {
					name,
					...config
				}
			}
		});
		setShowSettings(false);
	};

	return (
		<div className="host-group">
			<div className="group-header" onClick={toggleOpen}>
				<div className="group-title">
					{onSelectAll && (
						<input
							type="checkbox"
							checked={allSelected}
							onClick={handleSelectAllClick}
							onChange={() => { }}
							className="group-checkbox"
						/>
					)}
					<i className={`codicon codicon-chevron-${isOpen ? 'down' : 'right'}`}></i>
					{isRenaming ? (
						<input
							type="text"
							value={newName}
							onChange={e => setNewName(e.target.value)}
							onBlur={handleRenameSubmit}
							onKeyDown={handleRenameKeyDown}
							onClick={e => e.stopPropagation()}
							autoFocus
							className="rename-input"
						/>
					) : (
						<span onDoubleClick={handleRenameClick}>{name}</span>
					)}
					<span className="badge">{count}</span>
				</div>
				<div className="group-actions">
					{name !== 'Uncategorized' && (
						<button className="icon-button" onClick={handleRenameClick} title="Rename Folder">
							<i className="codicon codicon-edit"></i>
						</button>
					)}
					<button className="icon-button" onClick={handleSettingsClick} title="Folder Settings">
						<i className="codicon codicon-gear"></i>
					</button>
				</div>
			</div>
			{isOpen && <div className="group-content">{children}</div>}

			{showSettings && (
				<div className="modal-overlay">
					<div className="modal-content">
						<h3>Settings for {name}</h3>
						<div className="form-group">
							<label>Default Username</label>
							<input
								type="text"
								value={config.username || ''}
								onChange={e => setConfig(prev => ({ ...prev, username: e.target.value }))}
								placeholder="Inherited by hosts in this folder"
							/>
						</div>
						<div className="form-group">
							<label>Default Port</label>
							<input
								type="number"
								value={config.port || ''}
								onChange={e => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || undefined }))}
								placeholder="e.g. 22"
							/>
						</div>
						<div className="form-group">
							<label>Default Identity</label>
							<select
								value={config.credentialId || ''}
								onChange={e => setConfig(prev => ({ ...prev, credentialId: e.target.value }))}
							>
								<option value="">-- None --</option>
								{credentials.map(c => (
									<option key={c.id} value={c.id}>{c.name} ({c.username})</option>
								))}
							</select>
						</div>
						<div className="form-actions">
							<button className="primary-button" onClick={handleSaveSettings}>Save</button>
							<button className="secondary-button" onClick={() => setShowSettings(false)}>Cancel</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default HostGroup;

