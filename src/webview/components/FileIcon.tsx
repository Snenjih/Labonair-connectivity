import React from 'react';
import {
	Folder,
	File,
	FileText,
	FileCode,
	FileImage,
	FileArchive,
	FileVideo,
	FileAudio,
	Link,
	Database,
	Settings
} from 'lucide-react';
import { FileEntry } from '../../common/types';

interface FileIconProps {
	file: FileEntry;
	size?: number;
}

/**
 * FileIcon Component
 * Displays an appropriate icon based on file type and extension
 */
export const FileIcon: React.FC<FileIconProps> = ({ file, size = 16 }) => {
	const iconProps = {
		size,
		style: { flexShrink: 0 }
	};

	// Directory
	if (file.type === 'd') {
		return <Folder {...iconProps} style={{ ...iconProps.style, color: 'var(--vscode-terminal-ansiYellow)' }} />;
	}

	// Symlink
	if (file.type === 'l') {
		return <Link {...iconProps} style={{ ...iconProps.style, color: 'var(--vscode-terminal-ansiCyan)' }} />;
	}

	// File - determine by extension
	const extension = file.name.split('.').pop()?.toLowerCase() || '';

	// Code files
	const codeExtensions = ['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'swift', 'kt', 'scala', 'sh', 'bash', 'zsh'];
	if (codeExtensions.includes(extension)) {
		return <FileCode {...iconProps} style={{ ...iconProps.style, color: 'var(--vscode-terminal-ansiBlue)' }} />;
	}

	// Text/Document files
	const textExtensions = ['txt', 'md', 'markdown', 'log', 'csv', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config'];
	if (textExtensions.includes(extension)) {
		return <FileText {...iconProps} style={{ ...iconProps.style, color: 'var(--vscode-terminal-ansiWhite)' }} />;
	}

	// Image files
	const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'ico', 'webp', 'tiff'];
	if (imageExtensions.includes(extension)) {
		return <FileImage {...iconProps} style={{ ...iconProps.style, color: 'var(--vscode-terminal-ansiMagenta)' }} />;
	}

	// Archive files
	const archiveExtensions = ['zip', 'tar', 'gz', 'bz2', 'xz', 'rar', '7z', 'tgz'];
	if (archiveExtensions.includes(extension)) {
		return <FileArchive {...iconProps} style={{ ...iconProps.style, color: 'var(--vscode-terminal-ansiYellow)' }} />;
	}

	// Video files
	const videoExtensions = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'];
	if (videoExtensions.includes(extension)) {
		return <FileVideo {...iconProps} style={{ ...iconProps.style, color: 'var(--vscode-terminal-ansiRed)' }} />;
	}

	// Audio files
	const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'];
	if (audioExtensions.includes(extension)) {
		return <FileAudio {...iconProps} style={{ ...iconProps.style, color: 'var(--vscode-terminal-ansiGreen)' }} />;
	}

	// Database files
	const dbExtensions = ['db', 'sqlite', 'sql', 'mdb'];
	if (dbExtensions.includes(extension)) {
		return <Database {...iconProps} style={{ ...iconProps.style, color: 'var(--vscode-terminal-ansiCyan)' }} />;
	}

	// Config files
	const configExtensions = ['env', 'cfg', 'properties'];
	if (configExtensions.includes(extension) || file.name.startsWith('.')) {
		return <Settings {...iconProps} style={{ ...iconProps.style, color: 'var(--vscode-descriptionForeground)' }} />;
	}

	// Default file icon
	return <File {...iconProps} />;
};
