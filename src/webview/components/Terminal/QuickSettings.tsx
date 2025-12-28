import React, { useState } from 'react';
import vscode from '../../utils/vscode';

interface QuickSettingsProps {
	fontSize: number;
	onFontSizeChange: (size: number) => void;
	encoding?: string;
	colorScheme?: 'normal' | 'high-contrast';
	onClose: () => void;
	position: { x: number; y: number };
}

/**
 * QuickSettings Component
 * Shows a popover with terminal configuration options
 * - Font Size Slider (10px - 24px)
 * - Encoding Dropdown (UTF-8, ISO-8859-1)
 * - Color Scheme Toggle (Normal, High Contrast)
 */
export const QuickSettings: React.FC<QuickSettingsProps> = ({
	fontSize,
	onFontSizeChange,
	encoding = 'UTF-8',
	colorScheme = 'normal',
	onClose,
	position
}) => {
	const [currentEncoding, setCurrentEncoding] = useState(encoding);
	const [currentColorScheme, setCurrentColorScheme] = useState(colorScheme);

	const handleEncodingChange = (newEncoding: string) => {
		setCurrentEncoding(newEncoding);
		vscode.postMessage({
			command: 'CHANGE_ENCODING',
			payload: { encoding: newEncoding }
		});
	};

	const handleColorSchemeToggle = () => {
		const newScheme = currentColorScheme === 'normal' ? 'high-contrast' : 'normal';
		setCurrentColorScheme(newScheme);

		// Apply color scheme immediately via CSS
		const terminal = document.querySelector('.terminal-wrapper');
		if (terminal) {
			if (newScheme === 'high-contrast') {
				(terminal as HTMLElement).style.backgroundColor = '#000';
				(terminal as HTMLElement).style.color = '#fff';
			} else {
				(terminal as HTMLElement).style.backgroundColor = '';
				(terminal as HTMLElement).style.color = '';
			}
		}
	};

	const handleSave = () => {
		vscode.postMessage({
			command: 'SAVE_TERMINAL_CONFIG',
			payload: {
				fontSize,
				encoding: currentEncoding,
				colorScheme: currentColorScheme
			}
		});
		onClose();
	};

	return (
		<>
			{/* Overlay to close on click outside */}
			<div className="quick-settings-overlay" onClick={onClose} />

			{/* Settings Panel */}
			<div
				className="quick-settings-panel"
				style={{
					left: `${position.x}px`,
					top: `${position.y}px`
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="quick-settings-header">
					<h3>Terminal Settings</h3>
					<button className="quick-settings-close" onClick={onClose}>×</button>
				</div>

				<div className="quick-settings-content">
					{/* Font Size Slider */}
					<div className="setting-group">
						<label htmlFor="font-size-slider">
							Font Size: <span className="setting-value">{fontSize}px</span>
						</label>
						<input
							id="font-size-slider"
							type="range"
							min="10"
							max="24"
							value={fontSize}
							onChange={(e) => onFontSizeChange(parseInt(e.target.value))}
							className="font-size-slider"
						/>
						<div className="slider-labels">
							<span>10px</span>
							<span>24px</span>
						</div>
					</div>

					{/* Encoding Dropdown */}
					<div className="setting-group">
						<label htmlFor="encoding-select">Encoding</label>
						<select
							id="encoding-select"
							value={currentEncoding}
							onChange={(e) => handleEncodingChange(e.target.value)}
							className="encoding-select"
						>
							<option value="UTF-8">UTF-8</option>
							<option value="ISO-8859-1">ISO-8859-1 (Latin-1)</option>
							<option value="Windows-1252">Windows-1252</option>
							<option value="ASCII">ASCII</option>
						</select>
					</div>

					{/* Color Scheme Toggle */}
					<div className="setting-group">
						<label>Color Scheme</label>
						<div className="color-scheme-toggle">
							<button
								className={`scheme-button ${currentColorScheme === 'normal' ? 'active' : ''}`}
								onClick={() => {
									setCurrentColorScheme('normal');
									const terminal = document.querySelector('.terminal-wrapper');
									if (terminal) {
										(terminal as HTMLElement).style.backgroundColor = '';
										(terminal as HTMLElement).style.color = '';
									}
								}}
							>
								Normal
							</button>
							<button
								className={`scheme-button ${currentColorScheme === 'high-contrast' ? 'active' : ''}`}
								onClick={handleColorSchemeToggle}
							>
								High Contrast
							</button>
						</div>
					</div>
				</div>

				<div className="quick-settings-footer">
					<button className="settings-button settings-button-cancel" onClick={onClose}>
						Cancel
					</button>
					<button className="settings-button settings-button-save" onClick={handleSave}>
						Save
					</button>
				</div>
			</div>
		</>
	);
};
