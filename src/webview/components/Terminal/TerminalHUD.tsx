import React from 'react';
import { RefreshCw, Folder, SplitSquareVertical, SplitSquareHorizontal } from 'lucide-react';

interface TerminalHUDProps {
	status: 'connecting' | 'connected' | 'disconnected' | 'error';
	hostName: string;
	username?: string;
	host?: string;
	port?: number;
	onReconnect: () => void;
	onOpenSftp: () => void;
	onSplitVertical?: () => void;
	onSplitHorizontal?: () => void;
	splitMode?: 'none' | 'vertical' | 'horizontal';
}

const TerminalHUD: React.FC<TerminalHUDProps> = ({
	status,
	hostName,
	username,
	host,
	port,
	onReconnect,
	onOpenSftp,
	onSplitVertical,
	onSplitHorizontal,
	splitMode = 'none'
}) => {
	const getStatusColor = () => {
		switch (status) {
			case 'connected':
				return 'var(--vscode-testing-iconPassed, #73c991)';
			case 'connecting':
				return 'var(--vscode-testing-iconQueued, #cca700)';
			case 'disconnected':
			case 'error':
				return 'var(--vscode-testing-iconFailed, #f48771)';
			default:
				return 'var(--vscode-foreground)';
		}
	};

	const getStatusText = () => {
		switch (status) {
			case 'connected':
				return 'Connected';
			case 'connecting':
				return 'Connecting...';
			case 'disconnected':
				return 'Disconnected';
			case 'error':
				return 'Error';
			default:
				return 'Unknown';
		}
	};

	const getConnectionInfo = () => {
		if (!username || !host) {
			return hostName;
		}
		const portStr = port && port !== 22 ? `:${port}` : '';
		return `${username}@${host}${portStr}`;
	};

	return (
		<div className="terminal-hud">
			<div className="terminal-hud-main">
				{/* Status Indicator */}
				<div className="terminal-status">
					<div
						className={`terminal-status-indicator ${status === 'connected' ? 'pulse' : ''}`}
						style={{ backgroundColor: getStatusColor() }}
					/>
					<span className="terminal-status-text">{getStatusText()}</span>
				</div>

				{/* Host Name / Connection Info */}
				<div className="terminal-host-name">{getConnectionInfo()}</div>

				{/* Actions */}
				<div className="terminal-actions">
					{splitMode === 'none' && onSplitVertical && (
						<button
							className="terminal-action-button"
							onClick={onSplitVertical}
							title="Split Vertically"
						>
							<SplitSquareVertical size={16} />
						</button>
					)}
					{splitMode === 'none' && onSplitHorizontal && (
						<button
							className="terminal-action-button"
							onClick={onSplitHorizontal}
							title="Split Horizontally"
						>
							<SplitSquareHorizontal size={16} />
						</button>
					)}
					<button
						className="terminal-action-button"
						onClick={onOpenSftp}
						title="Open SFTP File Manager"
					>
						<Folder size={16} />
					</button>
					<button
						className="terminal-action-button terminal-reconnect-button"
						onClick={onReconnect}
						title="Reconnect"
					>
						<RefreshCw size={16} />
						<span>Reconnect</span>
					</button>
				</div>
			</div>
		</div>
	);
};

export default TerminalHUD;
