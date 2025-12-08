import React from 'react';
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
	onOpenStats?: () => void;
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
	onOpenStats,
	onMoveToFolder
}) => {
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

	const statusClass = status === 'online' ? 'status-online' :
		status === 'offline' ? 'status-offline' : 'status-unknown';

	return (
		<div
			className={`host-card ${isActive ? 'active-session' : ''} ${isSelected ? 'selected' : ''}`}
			onDoubleClick={onConnect}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<div className="card-top">
				{onToggleSelect && (
					<input
						type="checkbox"
						checked={isSelected}
						onChange={onToggleSelect}
						onClick={e => e.stopPropagation()}
					/>
				)}
				<div className={`status-indicator ${statusClass}`} title={`Status: ${status}`}></div>
				{isActive && <div className="active-indicator" title="Active Session"></div>}
				<div className="host-info">
					<div className="host-name">
						{host.pin && <i className="codicon codicon-pinned pin-icon" title="Pinned"></i>}
						<i className={`codicon codicon-${host.osIcon === 'windows' ? 'window' : 'terminal-linux'}`}></i>
						{host.name}
					</div>
					<div className="host-address">
						{host.username}@{host.host}:{host.port}
					</div>
				</div>
				{onTogglePin && (
					<button className="icon-button" onClick={onTogglePin} title={host.pin ? 'Unpin' : 'Pin'}>
						<i className={`codicon codicon-${host.pin ? 'pinned' : 'pin'}`}></i>
					</button>
				)}
			</div>

			<div className="card-middle">
				{host.tags.map((tag, index) => (
					<span key={index} className="tag-pill">{tag}</span>
				))}
				{host.notes && (
					<span className="notes-icon" title={host.notes}>
						<i className="codicon codicon-note"></i>
					</span>
				)}
			</div>

			<div className="card-bottom">
				{onOpenStats && (
					<button className="action-btn secondary" title="Stats" onClick={onOpenStats}>
						<i className="codicon codicon-graph"></i>
					</button>
				)}
				<button className="action-btn" title="SSH" onClick={onConnect}>
					<i className="codicon codicon-remote"></i>
				</button>
				{onOpenSftp && (
					<button className="action-btn" title="SFTP" onClick={onOpenSftp}>
						<i className="codicon codicon-file-symlink-directory"></i>
					</button>
				)}
				<button className="action-btn secondary" onClick={onManageTunnels} title="Tunnels">
					<i className="codicon codicon-plug"></i>
				</button>
				<button className="action-btn secondary" onClick={onEdit} title="Edit">
					<i className="codicon codicon-edit"></i>
				</button>
				<button className="action-btn secondary" onClick={onDelete} title="Delete">
					<i className="codicon codicon-trash"></i>
				</button>
			</div>
		</div>
	);
};

export default HostCard;

