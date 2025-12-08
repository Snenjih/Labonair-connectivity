import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import vscode from '../utils/vscode';
import { Host } from '../../common/types';
import TerminalHUD from '../components/Terminal/TerminalHUD';
import PasteModal from '../components/Terminal/PasteModal';
import '../styles/terminal.css';

interface TerminalViewProps {
	hostId: string;
	host?: Host;
}

const TerminalView: React.FC<TerminalViewProps> = ({ hostId, host }) => {
	const terminalRef = useRef<HTMLDivElement>(null);
	const xtermRef = useRef<Terminal | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const resizeObserverRef = useRef<ResizeObserver | null>(null);

	const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
	const [statusMessage, setStatusMessage] = useState<string>('');
	const [pasteData, setPasteData] = useState<string | null>(null);
	const [fontSize, setFontSize] = useState<number>(14);

	useEffect(() => {
		if (!terminalRef.current) return;

		// Initialize xterm.js
		const term = new Terminal({
			fontFamily: 'var(--vscode-editor-font-family, monospace)',
			fontSize: fontSize,
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

		// Add addons
		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);

		const webLinksAddon = new WebLinksAddon((event, uri) => {
			// Check if it looks like a file path
			if (uri.startsWith('/') || uri.match(/^~\//)) {
				event.preventDefault();
				vscode.postMessage({
					command: 'CHECK_FILE',
					payload: { path: uri, hostId }
				});
			}
		});
		term.loadAddon(webLinksAddon);

		// Open terminal
		term.open(terminalRef.current);
		fitAddon.fit();

		// Store references
		xtermRef.current = term;
		fitAddonRef.current = fitAddon;

		// Handle user input
		term.onData((data) => {
			// Check for paste protection
			if (data.includes('\n') && data.length > 10) {
				setPasteData(data);
			} else {
				vscode.postMessage({
					command: 'TERM_INPUT',
					payload: { data }
				});
			}
		});

		// Setup resize observer
		const resizeObserver = new ResizeObserver(() => {
			if (fitAddonRef.current && xtermRef.current) {
				fitAddonRef.current.fit();
				vscode.postMessage({
					command: 'TERM_RESIZE',
					payload: {
						cols: xtermRef.current.cols,
						rows: xtermRef.current.rows
					}
				});
			}
		});
		resizeObserver.observe(terminalRef.current);
		resizeObserverRef.current = resizeObserver;

		// Theme sync - watch for theme changes
		const observer = new MutationObserver(() => {
			updateTheme(term);
		});
		observer.observe(document.body, {
			attributes: true,
			attributeFilter: ['class']
		});

		// Initial theme update
		updateTheme(term);

		// Listen for messages from extension
		const handleMessage = (event: MessageEvent) => {
			const message = event.data;
			switch (message.command) {
				case 'TERM_DATA':
					if (xtermRef.current) {
						xtermRef.current.write(message.payload.data);
					}
					break;
				case 'TERM_STATUS':
					setStatus(message.payload.status);
					setStatusMessage(message.payload.message || '');
					break;
			}
		};

		window.addEventListener('message', handleMessage);

		// Cleanup
		return () => {
			window.removeEventListener('message', handleMessage);
			observer.disconnect();
			if (resizeObserverRef.current) {
				resizeObserverRef.current.disconnect();
			}
			if (xtermRef.current) {
				xtermRef.current.dispose();
			}
		};
	}, [hostId]);

	// Update font size when it changes
	useEffect(() => {
		if (xtermRef.current) {
			xtermRef.current.options.fontSize = fontSize;
			if (fitAddonRef.current) {
				fitAddonRef.current.fit();
			}
		}
	}, [fontSize]);

	const updateTheme = (term: Terminal) => {
		// Get computed styles from CSS variables
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

	const handleReconnect = () => {
		vscode.postMessage({
			command: 'TERM_RECONNECT',
			payload: { hostId }
		});
	};

	const handleOpenSftp = () => {
		vscode.postMessage({
			command: 'OPEN_SFTP',
			payload: { id: hostId }
		});
	};

	const handlePasteConfirm = () => {
		if (pasteData) {
			vscode.postMessage({
				command: 'TERM_INPUT',
				payload: { data: pasteData }
			});
			setPasteData(null);
		}
	};

	const handlePasteCancel = () => {
		setPasteData(null);
	};

	const handleFontSizeChange = (newSize: number) => {
		setFontSize(newSize);
	};

	return (
		<div className="terminal-container">
			<TerminalHUD
				status={status}
				hostName={host?.name || host?.host || 'Unknown'}
				onReconnect={handleReconnect}
				onOpenSftp={handleOpenSftp}
				fontSize={fontSize}
				onFontSizeChange={handleFontSizeChange}
			/>

			<div className="terminal-wrapper" ref={terminalRef} />

			{pasteData && (
				<PasteModal
					content={pasteData}
					onConfirm={handlePasteConfirm}
					onCancel={handlePasteCancel}
				/>
			)}

			{status === 'error' && (
				<div className="terminal-error-overlay">
					<div className="terminal-error-message">
						<h3>Connection Error</h3>
						<p>{statusMessage}</p>
						<button onClick={handleReconnect}>Reconnect</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default TerminalView;
