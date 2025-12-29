import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import vscode from '../../utils/vscode';

interface ConsoleProps {
	hostId: string;
	visible: boolean;
	height: number;
	onHeightChange: (height: number) => void;
	onToggle: () => void;
}

/**
 * Integrated Console Component for File Manager
 * Stripped-down terminal that syncs with the active panel's directory
 */
export const Console: React.FC<ConsoleProps> = ({
	hostId,
	visible,
	height,
	onHeightChange,
	onToggle
}) => {
	const terminalRef = useRef<HTMLDivElement>(null);
	const xtermRef = useRef<Terminal | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const resizeObserverRef = useRef<ResizeObserver | null>(null);
	const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
	const [isResizing, setIsResizing] = useState<boolean>(false);
	const resizeStartRef = useRef<{ y: number; height: number } | null>(null);

	// Initialize terminal
	useEffect(() => {
		if (!terminalRef.current || !visible) {
			return;
		}

		// Create terminal if it doesn't exist
		if (!xtermRef.current) {
			const term = new Terminal({
				fontFamily: 'var(--vscode-editor-font-family, monospace)',
				fontSize: 13,
				cursorBlink: true,
				cursorStyle: 'bar',
				theme: {
					background: 'var(--vscode-editor-background)',
					foreground: 'var(--vscode-editor-foreground)',
					cursor: 'var(--vscode-editorCursor-foreground)',
					selectionBackground: 'var(--vscode-editor-selectionBackground)',
					black: '#000000',
					red: '#cd3131',
					green: '#0dbc79',
					yellow: '#e5e510',
					blue: '#2472c8',
					magenta: '#bc3fbc',
					cyan: '#11a8cd',
					white: '#e5e5e5',
					brightBlack: '#666666',
					brightRed: '#f14c4c',
					brightGreen: '#23d18b',
					brightYellow: '#f5f543',
					brightBlue: '#3b8eea',
					brightMagenta: '#d670d6',
					brightCyan: '#29b8db',
					brightWhite: '#e5e5e5'
				}
			});

			const fitAddon = new FitAddon();
			term.loadAddon(fitAddon);

			const webLinksAddon = new WebLinksAddon((event, uri) => {
				if (uri.startsWith('/') || uri.startsWith('./') || uri.match(/^~\//)) {
					event.preventDefault();
					vscode.postMessage({
						command: 'OPEN_REMOTE_RESOURCE',
						payload: { path: uri, hostId }
					});
				}
			});
			term.loadAddon(webLinksAddon);

			term.open(terminalRef.current);
			fitAddon.fit();

			xtermRef.current = term;
			fitAddonRef.current = fitAddon;

			// Handle user input
			term.onData((data) => {
				vscode.postMessage({
					command: 'CONSOLE_INPUT',
					payload: { data, hostId }
				});
			});

			// Setup resize observer
			const resizeObserver = new ResizeObserver(() => {
				if (fitAddonRef.current && xtermRef.current) {
					fitAddonRef.current.fit();
					vscode.postMessage({
						command: 'CONSOLE_RESIZE',
						payload: {
							cols: xtermRef.current.cols,
							rows: xtermRef.current.rows,
							hostId
						}
					});
				}
			});
			resizeObserver.observe(terminalRef.current);
			resizeObserverRef.current = resizeObserver;

			// Update theme
			updateTheme(term);

			// Theme observer
			const themeObserver = new MutationObserver(() => {
				if (xtermRef.current) {
					updateTheme(xtermRef.current);
				}
			});
			themeObserver.observe(document.body, {
				attributes: true,
				attributeFilter: ['class']
			});
		}

		return () => {
			if (resizeObserverRef.current) {
				resizeObserverRef.current.disconnect();
			}
		};
	}, [visible, hostId]);

	// Listen for messages from extension
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;

			switch (message.command) {
				case 'CONSOLE_DATA':
					if (xtermRef.current) {
						xtermRef.current.write(message.payload.data);
					}
					break;

				case 'CONSOLE_STATUS':
					setStatus(message.payload.status);
					break;
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	// Update terminal theme
	const updateTheme = (term: Terminal) => {
		const computedStyle = getComputedStyle(document.body);
		term.options.theme = {
			background: computedStyle.getPropertyValue('--vscode-editor-background') || '#1e1e1e',
			foreground: computedStyle.getPropertyValue('--vscode-editor-foreground') || '#d4d4d4',
			cursor: computedStyle.getPropertyValue('--vscode-editorCursor-foreground') || '#ffffff',
			selectionBackground: computedStyle.getPropertyValue('--vscode-editor-selectionBackground') || '#264f78',
			black: '#000000',
			red: '#cd3131',
			green: '#0dbc79',
			yellow: '#e5e510',
			blue: '#2472c8',
			magenta: '#bc3fbc',
			cyan: '#11a8cd',
			white: '#e5e5e5',
			brightBlack: '#666666',
			brightRed: '#f14c4c',
			brightGreen: '#23d18b',
			brightYellow: '#f5f543',
			brightBlue: '#3b8eea',
			brightMagenta: '#d670d6',
			brightCyan: '#29b8db',
			brightWhite: '#e5e5e5'
		};
	};

	// Handle resize start
	const handleResizeStart = (e: React.MouseEvent) => {
		e.preventDefault();
		setIsResizing(true);
		resizeStartRef.current = {
			y: e.clientY,
			height: height
		};
	};

	// Handle resize move
	useEffect(() => {
		if (!isResizing) {
			return;
		}

		const handleMouseMove = (e: MouseEvent) => {
			if (!resizeStartRef.current) {
				return;
			}

			const delta = resizeStartRef.current.y - e.clientY;
			const newHeight = Math.max(100, Math.min(600, resizeStartRef.current.height + delta));
			onHeightChange(newHeight);
		};

		const handleMouseUp = () => {
			setIsResizing(false);
			resizeStartRef.current = null;
		};

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);

		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
		};
	}, [isResizing, onHeightChange]);

	if (!visible) {
		return null;
	}

	return (
		<div className="console-container" style={{ height: `${height}px` }}>
			{/* Resize handle */}
			<div
				className="console-resize-handle"
				onMouseDown={handleResizeStart}
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					height: '4px',
					cursor: 'ns-resize',
					backgroundColor: 'var(--vscode-panel-border)',
					zIndex: 10
				}}
			/>

			{/* Header */}
			<div className="console-header">
				<div className="console-title">
					<span className="console-icon">$</span>
					<span>Integrated Console</span>
					{status === 'connected' && (
						<span className="console-status-indicator" style={{ color: 'var(--vscode-testing-iconPassed)' }}>●</span>
					)}
					{status === 'connecting' && (
						<span className="console-status-indicator" style={{ color: 'var(--vscode-testing-iconQueued)' }}>●</span>
					)}
					{status === 'error' && (
						<span className="console-status-indicator" style={{ color: 'var(--vscode-testing-iconFailed)' }}>●</span>
					)}
				</div>
				<button
					className="console-close-button"
					onClick={onToggle}
					title="Hide Console"
					style={{
						background: 'none',
						border: 'none',
						color: 'var(--vscode-foreground)',
						cursor: 'pointer',
						padding: '4px 8px',
						fontSize: '16px'
					}}
				>
					×
				</button>
			</div>

			{/* Terminal */}
			<div
				ref={terminalRef}
				className="console-terminal"
				style={{
					height: 'calc(100% - 28px)',
					overflow: 'hidden',
					padding: '4px'
				}}
			/>
		</div>
	);
};
