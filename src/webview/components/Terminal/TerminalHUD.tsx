import React, { useState } from 'react';
import { RefreshCw, Folder, Settings, SplitSquareVertical, SplitSquareHorizontal } from 'lucide-react';
import { QuickSettings } from './QuickSettings';

interface TerminalHUDProps {
	status: 'connecting' | 'connected' | 'disconnected' | 'error';
	hostName: string;
	onReconnect: () => void;
	onOpenSftp: () => void;
	fontSize: number;
	onFontSizeChange: (size: number) => void;
	onSplitVertical?: () => void;
	onSplitHorizontal?: () => void;
	splitMode?: 'none' | 'vertical' | 'horizontal';
}

const TerminalHUD: React.FC<TerminalHUDProps> = ({
	status,
	hostName,
	onReconnect,
	onOpenSftp,
	fontSize,
	onFontSizeChange,
	onSplitVertical,
	onSplitHorizontal,
	splitMode = 'none'
}) => {
	const [showSettings, setShowSettings] = useState(false);
	const [showQuickSettings, setShowQuickSettings] = useState(false);
	const [quickSettingsPosition, setQuickSettingsPosition] = useState({ x: 0, y: 0 });

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		setQuickSettingsPosition({ x: e.clientX, y: e.clientY });
		setShowQuickSettings(true);
	};

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
		<div className="terminal-hud" onContextMenu={handleContextMenu}>
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

			{/* Quick Settings (Right-click menu) */}
			{showQuickSettings && (
				<QuickSettings
					fontSize={fontSize}
					onFontSizeChange={onFontSizeChange}
					onClose={() => setShowQuickSettings(false)}
					position={quickSettingsPosition}
				/>
			)}
		</div>
	);
};

export default TerminalHUD;
