import React from 'react';

interface FooterProps {
	layoutMode: 'explorer' | 'commander';
	hasSelection: boolean;
	hasFocusedFile: boolean;
}

/**
 * Footer Component - F-Keys Bar
 * Displays clickable F-key shortcuts in Commander mode
 */
export const Footer: React.FC<FooterProps> = ({ layoutMode, hasSelection, hasFocusedFile }) => {
	if (layoutMode !== 'commander') {
		return null;
	}

	const fKeys = [
		{ key: 'F3', label: 'View', enabled: hasFocusedFile },
		{ key: 'F4', label: 'Edit', enabled: hasFocusedFile },
		{ key: 'F5', label: 'Copy', enabled: hasSelection },
		{ key: 'F6', label: 'Move', enabled: hasSelection },
		{ key: 'F7', label: 'MkDir', enabled: true },
		{ key: 'F8', label: 'Delete', enabled: hasSelection }
	];

	const handleFKeyClick = (key: string) => {
		// Dispatch a keyboard event to trigger the F-key handler
		const event = new KeyboardEvent('keydown', {
			key,
			bubbles: true,
			cancelable: true
		});
		window.dispatchEvent(event);
	};

	return (
		<div className="file-manager-footer">
			{fKeys.map(({ key, label, enabled }) => (
				<button
					key={key}
					className={`fkey-button ${enabled ? '' : 'disabled'}`}
					onClick={() => enabled && handleFKeyClick(key)}
					disabled={!enabled}
				>
					<span className="fkey-number">{key}</span>
					<span className="fkey-label">{label}</span>
				</button>
			))}
		</div>
	);
};
