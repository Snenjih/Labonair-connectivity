import React, { useState } from 'react';
import { Host, HostStatus } from '../../common/types';

interface HostCardProps {
	host: Host;
	isActive?: boolean;
	isSelected?: boolean;
	status?: HostStatus;
	onConnect: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onManageTunnels: () => void;
	onTogglePin?: () => void;
	onToggleSelect?: () => void;
	onOpenSftp?: () => void;
	onClone?: () => void;
	onExport?: () => void;
	onMoveToFolder?: (hostId: string, folder: string) => void;
}

const HostCard: React.FC<HostCardProps> = ({
	host,
	isActive,
	isSelected,
	status = 'unknown',
	onConnect,
	onEdit,
	onDelete,
	onManageTunnels,
	onTogglePin,
	onToggleSelect,
	onOpenSftp,
	onClone,
	onExport,
	onMoveToFolder
}) => {
	const [showOptions, setShowOptions] = useState(false);

	const handleDragStart = (e: React.DragEvent) => {
		e.dataTransfer.setData('application/labonair-host', host.id);
		e.dataTransfer.effectAllowed = 'move';
		e.currentTarget.classList.add('dragging');
	};

	const handleDragEnd = (e: React.DragEvent) => {
		e.currentTarget.classList.remove('dragging');
	};

	const handleDragOver = (e: React.DragEvent) => {
		if (e.dataTransfer.types.includes('application/labonair-script')) {
			e.preventDefault();
			e.dataTransfer.dropEffect = 'copy';
			e.currentTarget.classList.add('drag-over');
		}
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.currentTarget.classList.remove('drag-over');
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.currentTarget.classList.remove('drag-over');
		const scriptId = e.dataTransfer.getData('application/labonair-script');
		if (scriptId) {
			// @ts-ignore
			vscode.postMessage({ command: 'RUN_SCRIPT', payload: { scriptId, hostId: host.id } });
		}
	};

	const handleOptionsClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		setShowOptions(!showOptions);
	};

	const handleOptionAction = (action: () => void) => {
		return (e: React.MouseEvent) => {
			e.stopPropagation();
			setShowOptions(false);
			action();
		};
	};

	// Close options menu when clicking outside
	React.useEffect(() => {
		const handleClickOutside = () => setShowOptions(false);
		if (showOptions) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	}, [showOptions]);

	const statusClass = status === 'online' ? 'status-online' :
		status === 'offline' ? 'status-offline' : 'status-unknown';

	return (
		<div
			className={`host-card ${isActive ? 'active-session' : ''} ${isSelected ? 'selected' : ''}`}
			draggable
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{/* Top Row: Checkbox, Host Info, Options */}
			<div className="card-top">
				{onToggleSelect && (
					<input
						type="checkbox"
						checked={isSelected}
						onChange={onToggleSelect}
						onClick={e => e.stopPropagation()}
					/>
				)}
				<div className="host-info" onClick={onEdit}>
					<div className="host-name">
						{host.pin && <i className="codicon codicon-pinned pin-icon" title="Pinned"></i>}
						<span>{host.name || `${host.username}@${host.host}`}</span>
					</div>
					<div className="host-address">{host.host}:{host.port}</div>
					<div className="host-address">{host.username}</div>
				</div>
				{/* Options Button */}
				<div className="options-wrapper">
					<button className="icon-button options-btn" onClick={handleOptionsClick} title="Options">
						<i className="codicon codicon-ellipsis"></i>
					</button>
					{showOptions && (
						<div className="options-menu" onClick={e => e.stopPropagation()}>
							<button className="option-item" onClick={handleOptionAction(onEdit)}>
								<i className="codicon codicon-edit"></i>
								Edit Host
							</button>
							{onClone && (
								<button className="option-item" onClick={handleOptionAction(onClone)}>
									<i className="codicon codicon-copy"></i>
									Clone Host
								</button>
							)}
							{onExport && (
								<button className="option-item" onClick={handleOptionAction(onExport)}>
									<i className="codicon codicon-cloud-download"></i>
									Export Host
								</button>
							)}
							<div className="option-divider"></div>
							<button className="option-item danger" onClick={handleOptionAction(onDelete)}>
								<i className="codicon codicon-trash"></i>
								Delete Host
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Middle: Tags */}
			{host.tags && host.tags.length > 0 && (
				<div className="card-middle">
					{host.tags.slice(0, 4).map((tag, index) => (
						<span key={index} className="tag-pill">
							<i className="codicon codicon-tag"></i>
							{tag}
						</span>
					))}
					{host.tags.length > 4 && (
						<span className="tag-pill">+{host.tags.length - 4}</span>
					)}
				</div>
			)}

			{/* Feature Badges */}
			<div className="card-middle">
				{host.enableTerminal !== false && (
					<span className="feature-badge">
						<i className="codicon codicon-terminal"></i>
						Terminal
					</span>
				)}
				{host.tunnels && host.tunnels.length > 0 && (
					<span className="feature-badge">
						<i className="codicon codicon-plug"></i>
						Tunnel ({host.tunnels.length})
					</span>
				)}
				{host.enableFileManager !== false && (
					<span className="feature-badge">
						<i className="codicon codicon-files"></i>
						SFTP
					</span>
				)}
			</div>

			{/* Bottom: Primary Action Buttons - SSH and SFTP only */}
			<div className="card-bottom">
				{host.enableTerminal !== false && (
					<button className="action-btn" onClick={(e) => { e.stopPropagation(); onConnect(); }} title="SSH Terminal">
						<i className="codicon codicon-terminal"></i>
						SSH
					</button>
				)}
				{host.enableFileManager !== false && onOpenSftp && (
					<button className="action-btn" onClick={(e) => { e.stopPropagation(); onOpenSftp(); }} title="SFTP File Manager">
						<i className="codicon codicon-files"></i>
						SFTP
					</button>
				)}
			</div>
		</div>
	);
};

export default HostCard;
