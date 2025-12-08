import React, { useState } from 'react';
import { RefreshCw, Folder, Settings } from 'lucide-react';

interface TerminalHUDProps {
	status: 'connecting' | 'connected' | 'disconnected' | 'error';
	hostName: string;
	onReconnect: () => void;
	onOpenSftp: () => void;
	fontSize: number;
	onFontSizeChange: (size: number) => void;
}

const TerminalHUD: React.FC<TerminalHUDProps> = ({
	status,
	hostName,
	onReconnect,
	onOpenSftp,
	fontSize,
	onFontSizeChange
}) => {
	const [showSettings, setShowSettings] = useState(false);

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
					<button
						className="terminal-action-button"
						onClick={() => setShowSettings(!showSettings)}
						title="Settings"
					>
						<Settings size={16} />
					</button>
				</div>
			</div>

			{/* Quick Settings */}
			{showSettings && (
				<div className="terminal-quick-settings">
					<div className="terminal-setting">
						<label>Font Size</label>
						<div className="terminal-font-size-control">
							<button
								onClick={() => onFontSizeChange(Math.max(8, fontSize - 1))}
								className="terminal-font-size-button"
							>
								-
							</button>
							<span className="terminal-font-size-value">{fontSize}px</span>
							<button
								onClick={() => onFontSizeChange(Math.min(30, fontSize + 1))}
								className="terminal-font-size-button"
							>
								+
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default TerminalHUD;
