import React from 'react';
import { RefreshCw, Folder, SplitSquareVertical, SplitSquareHorizontal } from 'lucide-react';

interface TerminalHUDProps {
	status: 'connecting' | 'connected' | 'disconnected' | 'error';
	hostName: string;
	onReconnect: () => void;
	onOpenSftp: () => void;
	onSplitVertical?: () => void;
	onSplitHorizontal?: () => void;
	splitMode?: 'none' | 'vertical' | 'horizontal';
}

const TerminalHUD: React.FC<TerminalHUDProps> = ({
	status,
	hostName,
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

				{/* Host Name */}
				<div className="terminal-host-name">{hostName}</div>

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
						onClick={onReconnect}
						title="Reconnect"
					>
						<RefreshCw size={16} />
					</button>
					<button
						className="terminal-action-button"
						onClick={onOpenSftp}
						title="Open SFTP File Manager"
					>
						<Folder size={16} />
					</button>
				</div>
			</div>
		</div>
	);
};

export default TerminalHUD;
