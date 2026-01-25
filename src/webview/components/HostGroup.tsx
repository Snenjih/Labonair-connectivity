import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Edit, Settings } from 'lucide-react';
import { Credential } from '../../common/types';
import vscode from '../utils/vscode';

interface HostGroupProps {
	name: string;
	count: number;
	credentials?: Credential[];
	children: React.ReactNode;
	selectedHostIds?: string[];
	onToggleGroupSelection?: () => void;
	onRenameFolder?: (oldName: string, newName: string) => void;
	isExpanded?: boolean;
	onToggleExpanded?: (folderName: string, expanded: boolean) => void;
}

const HostGroup: React.FC<HostGroupProps> = ({
	name,
	count,
	credentials = [],
	children,
	selectedHostIds = [],
	onToggleGroupSelection,
	onRenameFolder,
	isExpanded = true,
	onToggleExpanded
}) => {
	const [showSettings, setShowSettings] = useState(false);
	const [isRenaming, setIsRenaming] = useState(false);
	const [newName, setNewName] = useState(name);
	const [config, setConfig] = useState<{ username?: string, port?: number, credentialId?: string }>({});
	const [groupHostIds, setGroupHostIds] = useState<string[]>([]);

	const toggleOpen = () => {
		if (onToggleExpanded) {
			onToggleExpanded(name, !isExpanded);
		}
	};

	// Extract host IDs from children
	useEffect(() => {
		const ids: string[] = [];
		React.Children.forEach(children, (child) => {
			if (React.isValidElement(child) && child.props.host) {
				ids.push(child.props.host.id);
			}
		});
		setGroupHostIds(ids);
	}, [children]);

	// Check if all hosts in this group are selected
	const allSelected = useMemo(() => {
		if (groupHostIds.length === 0) return false;
		return groupHostIds.every(id => selectedHostIds.includes(id));
	}, [selectedHostIds, groupHostIds]);

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
		if (onToggleGroupSelection) {
			onToggleGroupSelection();
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
					{onToggleGroupSelection && (
						<input
							type="checkbox"
							checked={allSelected}
							onClick={handleSelectAllClick}
							onChange={() => { }}
							className="group-checkbox"
						/>
					)}
					{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
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
							<Edit size={16} />
						</button>
					)}
					<button className="icon-button" onClick={handleSettingsClick} title="Folder Settings">
						<Settings size={16} />
					</button>
				</div>
			</div>
			{isExpanded && <div className="group-content">{children}</div>}

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

