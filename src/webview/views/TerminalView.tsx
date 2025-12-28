import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import vscode from '../utils/vscode';
import { Host } from '../../common/types';
import TerminalHUD from '../components/Terminal/TerminalHUD';
import PasteModal from '../components/Terminal/PasteModal';
import { DropOverlay } from '../components/Terminal/DropOverlay';
import SearchWidget, { SearchOptions } from '../components/Terminal/SearchWidget';
import '../styles/terminal.css';

interface TerminalViewProps {
	hostId: string;
	host?: Host;
}

const TerminalView: React.FC<TerminalViewProps> = ({ hostId, host }) => {
	const terminal1Ref = useRef<HTMLDivElement>(null);
	const terminal2Ref = useRef<HTMLDivElement>(null);
	const xterm1Ref = useRef<Terminal | null>(null);
	const xterm2Ref = useRef<Terminal | null>(null);
	const fitAddon1Ref = useRef<FitAddon | null>(null);
	const fitAddon2Ref = useRef<FitAddon | null>(null);
	const searchAddon1Ref = useRef<SearchAddon | null>(null);
	const searchAddon2Ref = useRef<SearchAddon | null>(null);
	const resizeObserver1Ref = useRef<ResizeObserver | null>(null);
	const resizeObserver2Ref = useRef<ResizeObserver | null>(null);

	const [splitMode, setSplitMode] = useState<'none' | 'vertical' | 'horizontal'>('none');
	const [activeSplit, setActiveSplit] = useState<number>(1);
	const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
	const [statusMessage, setStatusMessage] = useState<string>('');
	const [pasteData, setPasteData] = useState<string | null>(null);
	const [fontSize, setFontSize] = useState<number>(14);
	const [searchVisible, setSearchVisible] = useState<boolean>(false);

	useEffect(() => {
		// Initialize first terminal
		if (!terminal1Ref.current) return;

		const term1 = new Terminal({
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

		const fitAddon1 = new FitAddon();
		term1.loadAddon(fitAddon1);

		const searchAddon1 = new SearchAddon();
		term1.loadAddon(searchAddon1);

		const webLinksAddon1 = new WebLinksAddon((event, uri) => {
			if (uri.startsWith('/') || uri.match(/^~\//)) {
				event.preventDefault();
				vscode.postMessage({
					command: 'CHECK_FILE',
					payload: { path: uri, hostId }
				});
			}
		});
		term1.loadAddon(webLinksAddon1);

		term1.open(terminal1Ref.current);
		fitAddon1.fit();

		xterm1Ref.current = term1;
		fitAddon1Ref.current = fitAddon1;
		searchAddon1Ref.current = searchAddon1;

		// Copy on select behavior
		if (host?.terminalCopyOnSelect) {
			term1.onSelectionChange(() => {
				const selection = term1.getSelection();
				if (selection) {
					navigator.clipboard.writeText(selection).catch(err => {
						console.error('Failed to copy to clipboard:', err);
					});
				}
			});
		}

		// Right-click behavior
		if (terminal1Ref.current) {
			const handleContextMenu = async (e: MouseEvent) => {
				if (host?.terminalRightClickBehavior === 'paste') {
					e.preventDefault();
					try {
						const text = await navigator.clipboard.readText();
						if (text) {
							vscode.postMessage({
								command: 'TERM_INPUT',
								payload: { data: text, splitId: 1 }
							});
						}
					} catch (err) {
						console.error('Failed to paste from clipboard:', err);
					}
				}
				// Otherwise, let the default context menu show
			};
			terminal1Ref.current.addEventListener('contextmenu', handleContextMenu);
		}

		term1.onData((data) => {
			if (data.includes('\n') && data.length > 10) {
				setPasteData(data);
			} else {
				vscode.postMessage({
					command: 'TERM_INPUT',
					payload: { data, splitId: 1 }
				});
			}
		});

		const resizeObserver1 = new ResizeObserver(() => {
			if (fitAddon1Ref.current && xterm1Ref.current) {
				fitAddon1Ref.current.fit();
				vscode.postMessage({
					command: 'TERM_RESIZE',
					payload: {
						cols: xterm1Ref.current.cols,
						rows: xterm1Ref.current.rows,
						splitId: 1
					}
				});
			}
		});
		resizeObserver1.observe(terminal1Ref.current);
		resizeObserver1Ref.current = resizeObserver1;

		const themeObserver = new MutationObserver(() => {
			updateTheme(term1);
			if (xterm2Ref.current) {
				updateTheme(xterm2Ref.current);
			}
		});
		themeObserver.observe(document.body, {
			attributes: true,
			attributeFilter: ['class']
		});

		updateTheme(term1);

		const handleMessage = (event: MessageEvent) => {
			const message = event.data;
			switch (message.command) {
				case 'TERM_DATA':
					const splitId = message.payload.splitId || 1;
					const term = splitId === 1 ? xterm1Ref.current : xterm2Ref.current;
					if (term) {
						term.write(message.payload.data);
					}
					break;
				case 'TERM_STATUS':
					setStatus(message.payload.status);
					setStatusMessage(message.payload.message || '');
					break;
				case 'UPDATE_DATA':
					if (message.payload.splitMode) {
						setSplitMode(message.payload.splitMode);
					}
					break;
			}
		};

		window.addEventListener('message', handleMessage);

		return () => {
			window.removeEventListener('message', handleMessage);
			themeObserver.disconnect();
			if (resizeObserver1Ref.current) {
				resizeObserver1Ref.current.disconnect();
			}
			if (xterm1Ref.current) {
				xterm1Ref.current.dispose();
			}
		};
	}, [hostId]);

	// Initialize second terminal when split mode is activated
	useEffect(() => {
		if (splitMode !== 'none' && terminal2Ref.current && !xterm2Ref.current) {
			const term2 = new Terminal({
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

			const fitAddon2 = new FitAddon();
			term2.loadAddon(fitAddon2);

			const searchAddon2 = new SearchAddon();
			term2.loadAddon(searchAddon2);

			const webLinksAddon2 = new WebLinksAddon((event, uri) => {
				if (uri.startsWith('/') || uri.match(/^~\//)) {
					event.preventDefault();
					vscode.postMessage({
						command: 'CHECK_FILE',
						payload: { path: uri, hostId }
					});
				}
			});
			term2.loadAddon(webLinksAddon2);

			term2.open(terminal2Ref.current);
			fitAddon2.fit();

			xterm2Ref.current = term2;
			fitAddon2Ref.current = fitAddon2;
			searchAddon2Ref.current = searchAddon2;

			// Copy on select behavior
			if (host?.terminalCopyOnSelect) {
				term2.onSelectionChange(() => {
					const selection = term2.getSelection();
					if (selection) {
						navigator.clipboard.writeText(selection).catch(err => {
							console.error('Failed to copy to clipboard:', err);
						});
					}
				});
			}

			// Right-click behavior
			if (terminal2Ref.current) {
				const handleContextMenu = async (e: MouseEvent) => {
					if (host?.terminalRightClickBehavior === 'paste') {
						e.preventDefault();
						try {
							const text = await navigator.clipboard.readText();
							if (text) {
								vscode.postMessage({
									command: 'TERM_INPUT',
									payload: { data: text, splitId: 2 }
								});
							}
						} catch (err) {
							console.error('Failed to paste from clipboard:', err);
						}
					}
					// Otherwise, let the default context menu show
				};
				terminal2Ref.current.addEventListener('contextmenu', handleContextMenu);
			}

			term2.onData((data) => {
				if (data.includes('\n') && data.length > 10) {
					setPasteData(data);
				} else {
					vscode.postMessage({
						command: 'TERM_INPUT',
						payload: { data, splitId: 2 }
					});
				}
			});

			const resizeObserver2 = new ResizeObserver(() => {
				if (fitAddon2Ref.current && xterm2Ref.current) {
					fitAddon2Ref.current.fit();
					vscode.postMessage({
						command: 'TERM_RESIZE',
						payload: {
							cols: xterm2Ref.current.cols,
							rows: xterm2Ref.current.rows,
							splitId: 2
						}
					});
				}
			});
			resizeObserver2.observe(terminal2Ref.current);
			resizeObserver2Ref.current = resizeObserver2;

			updateTheme(term2);
		}

		return () => {
			if (resizeObserver2Ref.current) {
				resizeObserver2Ref.current.disconnect();
				resizeObserver2Ref.current = null;
			}
			if (xterm2Ref.current) {
				xterm2Ref.current.dispose();
				xterm2Ref.current = null;
			}
		};
	}, [splitMode]);

	// Update font size when it changes
	useEffect(() => {
		if (xterm1Ref.current) {
			xterm1Ref.current.options.fontSize = fontSize;
			if (fitAddon1Ref.current) {
				fitAddon1Ref.current.fit();
			}
		}
		if (xterm2Ref.current) {
			xterm2Ref.current.options.fontSize = fontSize;
			if (fitAddon2Ref.current) {
				fitAddon2Ref.current.fit();
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

	const handleSplitVertical = () => {
		vscode.postMessage({
			command: 'TERMINAL_SPLIT',
			payload: { mode: 'vertical' }
		});
	};

	const handleSplitHorizontal = () => {
		vscode.postMessage({
			command: 'TERMINAL_SPLIT',
			payload: { mode: 'horizontal' }
		});
	};

	const handleCloseSplit = (splitId: number) => {
		vscode.postMessage({
			command: 'TERMINAL_CLOSE_SPLIT',
			payload: { splitId }
		});
		setSplitMode('none');
	};

	const handlePastePath = (path: string) => {
		// Write path to active terminal
		const term = activeSplit === 1 ? xterm1Ref.current : xterm2Ref.current;
		if (term) {
			term.write(path);
		}
	};

	const handleUploadFile = (file: File) => {
		// Get current working directory (would need to be tracked or queried)
		// For now, use home directory as default
		vscode.postMessage({
			command: 'SFTP_UPLOAD',
			payload: { hostId, remotePath: '~', localPath: file.name }
		});
	};

	const handleSearch = (term: string, options: SearchOptions) => {
		const searchAddon = activeSplit === 1 ? searchAddon1Ref.current : searchAddon2Ref.current;
		if (searchAddon && term) {
			searchAddon.findNext(term, {
				caseSensitive: options.caseSensitive,
				wholeWord: options.wholeWord,
				regex: options.regex
			});
		}
	};

	const handleSearchNext = () => {
		const searchAddon = activeSplit === 1 ? searchAddon1Ref.current : searchAddon2Ref.current;
		if (searchAddon) {
			searchAddon.findNext('');
		}
	};

	const handleSearchPrevious = () => {
		const searchAddon = activeSplit === 1 ? searchAddon1Ref.current : searchAddon2Ref.current;
		if (searchAddon) {
			searchAddon.findPrevious('');
		}
	};

	const handleSearchClose = () => {
		setSearchVisible(false);
	};

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ctrl+F / Cmd+F to toggle search
			if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
				e.preventDefault();
				setSearchVisible(prev => !prev);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, []);

	return (
		<div className="terminal-container">
			{!searchVisible && (
				<TerminalHUD
					status={status}
					hostName={host?.name || host?.host || 'Unknown'}
					onReconnect={handleReconnect}
					onOpenSftp={handleOpenSftp}
					fontSize={fontSize}
					onFontSizeChange={handleFontSizeChange}
					onSplitVertical={handleSplitVertical}
					onSplitHorizontal={handleSplitHorizontal}
					splitMode={splitMode}
				/>
			)}

			<SearchWidget
				visible={searchVisible}
				onSearch={handleSearch}
				onNext={handleSearchNext}
				onPrevious={handleSearchPrevious}
				onClose={handleSearchClose}
			/>

			<div className={`terminal-layout terminal-layout-${splitMode}`}>
				<div
					className={`terminal-pane ${activeSplit === 1 ? 'active' : ''}`}
					onClick={() => setActiveSplit(1)}
					ref={terminal1Ref}
				/>
				{splitMode !== 'none' && (
					<div
						className={`terminal-pane ${activeSplit === 2 ? 'active' : ''}`}
						onClick={() => setActiveSplit(2)}
						ref={terminal2Ref}
					/>
				)}
			</div>

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

			{/* Drop Overlay for Smart Drag & Drop */}
			<DropOverlay
				onPastePath={handlePastePath}
				onUpload={handleUploadFile}
			/>
		</div>
	);
};

export default TerminalView;
