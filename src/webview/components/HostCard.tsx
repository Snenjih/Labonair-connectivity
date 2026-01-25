import React, { useState } from 'react';
import { Pin, MoreVertical, Edit, Copy, Download, Trash2, Tag, Terminal, Plug, Files } from 'lucide-react';
import { Host, HostStatus } from '../../common/types';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

interface TunnelStatus {
	type: 'local' | 'remote';
	srcPort: number;
	dstHost: string;
	dstPort: number;
	status: 'active' | 'error';
	error?: string;
}

interface HostCardProps {
	host: Host;
	isActive?: boolean;
	isSelected?: boolean;
	status?: HostStatus;
	tunnelStatuses?: TunnelStatus[];
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
	tunnelStatuses = [],
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
	const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

	// Calculate active tunnels
	const activeTunnels = tunnelStatuses.filter(t => t.status === 'active');
	const hasActiveTunnels = activeTunnels.length > 0;

	// Build tunnel tooltip
	const tunnelTooltip = activeTunnels.length > 0
		? activeTunnels.map(t => {
			const prefix = t.type === 'local' ? 'L' : 'R';
			return `${prefix}:${t.srcPort} → ${t.dstHost}:${t.dstPort}`;
		}).join('\n')
		: 'No active tunnels';

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
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		setContextMenu({
			x: rect.right,
			y: rect.bottom
		});
	};

	const contextMenuItems: ContextMenuItem[] = [
		{
			label: 'Edit Host',
			icon: Edit,
			action: onEdit
		},
		...(onClone ? [{
			label: 'Clone Host',
			icon: Copy,
			action: onClone
		}] : []),
		...(onExport ? [{
			label: 'Export Host',
			icon: Download,
			action: onExport
		}] : []),
		{
			label: 'Manage Tunnels',
			icon: Plug,
			action: onManageTunnels
		},
		{
			label: '',
			icon: undefined,
			action: () => {},
			separator: true
		},
		{
			label: 'Delete Host',
			icon: Trash2,
			action: onDelete,
			danger: true
		}
	];

	const statusClass = status === 'online' ? 'status-online' :
		status === 'offline' ? 'status-offline' : 'status-unknown';

	const handleDoubleClick = (e: React.MouseEvent) => {
		// Only trigger if not clicking on a button or checkbox
		const target = e.target as HTMLElement;
		if (!target.closest('button') && !target.closest('input[type="checkbox"]')) {
			onConnect();
		}
	};

	return (
		<div
			className={`host-card ${isActive ? 'active-session' : ''} ${isSelected ? 'selected' : ''}`}
			draggable
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			onDoubleClick={handleDoubleClick}
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
						{host.pin && <Pin size={16} style={{ color: '#eab308' }} aria-label="Pinned" />}
						<span>{host.name || `${host.username}@${host.host}`}</span>
					</div>
					<div className="host-address">{host.host}:{host.port}</div>
					<div className="host-address">{host.username}</div>
				</div>
				{/* Options Button */}
				<div className="options-wrapper">
					<button className="icon-button options-btn" onClick={handleOptionsClick} title="Options">
						<MoreVertical size={16} />
					</button>
				</div>
			</div>

			{/* Middle: Tags */}
			{host.tags && host.tags.length > 0 && (
				<div className="card-middle">
					{host.tags.slice(0, 4).map((tag, index) => (
						<span key={index} className="tag-pill">
							<Tag size={14} />
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
						<Terminal size={14} />
						Terminal
					</span>
				)}
				{host.tunnels && host.tunnels.length > 0 && (
					<span className="feature-badge" title={tunnelTooltip} style={{ position: 'relative' }}>
						<Plug size={14} />
						Tunnel ({host.tunnels.length})
						{hasActiveTunnels && (
							<span style={{
								position: 'absolute',
								top: '2px',
								right: '2px',
								width: '8px',
								height: '8px',
								borderRadius: '50%',
								backgroundColor: '#4ec9b0',
								border: '1px solid var(--vscode-editor-background)',
								boxShadow: '0 0 4px rgba(78, 201, 176, 0.6)'
							}} />
						)}
					</span>
				)}
				{host.enableFileManager !== false && (
					<span className="feature-badge">
						<Files size={14} />
						SFTP
					</span>
				)}
			</div>

			{/* Bottom: Primary Action Buttons - SSH and SFTP only */}
			<div className="card-bottom">
				{host.enableTerminal !== false && (
					<button className="primary-action-btn" onClick={(e) => { e.stopPropagation(); onConnect(); }} title="SSH Terminal">
						<Terminal size={14} />
						SSH
					</button>
				)}
				{host.enableFileManager !== false && onOpenSftp && (
					<button className="primary-action-btn" onClick={(e) => { e.stopPropagation(); onOpenSftp(); }} title="SFTP File Manager">
						<Files size={14} />
						SFTP
					</button>
				)}
			</div>

			{/* Context Menu - Phase 6.4 */}
			{contextMenu && (
				<ContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					items={contextMenuItems}
					onClose={() => setContextMenu(null)}
				/>
			)}
		</div>
	);
};

export default HostCard;
