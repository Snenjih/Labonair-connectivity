import React from 'react';
import { Host } from '../../common/types';

interface HostCardProps {
	host: Host;
	isActive?: boolean;
	onConnect: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onManageTunnels: () => void;
}

const HostCard: React.FC<HostCardProps> = ({ host, isActive, onConnect, onEdit, onDelete, onManageTunnels }) => {
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

	return (
		<div
			className={`host-card ${isActive ? 'active-session' : ''}`}
			onDoubleClick={onConnect}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<div className="card-top">
				{isActive && <div className="active-indicator" title="Active Session"></div>}
				<input type="checkbox" />
				<div className="host-info">
					<div className="host-name">
						<i className={`codicon codicon-${host.osIcon === 'windows' ? 'window' : 'terminal-linux'}`}></i>
						{host.name}
					</div>
					<div className="host-address">
						{host.username}@{host.host}:{host.port}
					</div>
				</div>
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
				<button className="action-btn" title="Stats">
					<i className="codicon codicon-graph"></i>
				</button>
				<button className="action-btn" title="SSH" onClick={onConnect}>
					<i className="codicon codicon-remote"></i>
				</button>
				<button className="action-btn" title="SFTP">
					<i className="codicon codicon-file-symlink-directory"></i>
				</button>
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
