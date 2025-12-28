import React, { useState, useEffect } from 'react';
import { FileText, Upload } from 'lucide-react';

interface DropOverlayProps {
	onPastePath: (path: string) => void;
	onUpload: (file: File) => void;
}

/**
 * DropOverlay Component
 * Shows a split overlay when files are dragged onto the terminal
 * - Top/Left: Paste Path (for file path string)
 * - Bottom/Right: Upload Here (for file upload)
 */
export const DropOverlay: React.FC<DropOverlayProps> = ({ onPastePath, onUpload }) => {
	const [isDragging, setIsDragging] = useState(false);
	const [hoveredZone, setHoveredZone] = useState<'paste' | 'upload' | null>(null);

	useEffect(() => {
		const handleDragEnter = (e: DragEvent) => {
			e.preventDefault();
			if (e.dataTransfer?.types.includes('Files')) {
				setIsDragging(true);
			}
		};

		const handleDragLeave = (e: DragEvent) => {
			e.preventDefault();
			// Only hide if leaving the window entirely
			if (e.relatedTarget === null) {
				setIsDragging(false);
				setHoveredZone(null);
			}
		};

		const handleDragOver = (e: DragEvent) => {
			e.preventDefault();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'copy';
			}
		};

		const handleDrop = (e: DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			setHoveredZone(null);
		};

		window.addEventListener('dragenter', handleDragEnter);
		window.addEventListener('dragleave', handleDragLeave);
		window.addEventListener('dragover', handleDragOver);
		window.addEventListener('drop', handleDrop);

		return () => {
			window.removeEventListener('dragenter', handleDragEnter);
			window.removeEventListener('dragleave', handleDragLeave);
			window.removeEventListener('dragover', handleDragOver);
			window.removeEventListener('drop', handleDrop);
		};
	}, []);

	const handleZoneDrop = (zone: 'paste' | 'upload', e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const files = Array.from(e.dataTransfer.files);
		if (files.length === 0) return;

		const file = files[0];

		if (zone === 'paste') {
			// Get file path and paste it to terminal
			// Note: Browser File API doesn't expose real file paths for security
			// We'll use the file name as a fallback
			const path = (file as any).path || file.name;
			onPastePath(path);
		} else {
			// Upload file to remote server
			onUpload(file);
		}

		setIsDragging(false);
		setHoveredZone(null);
	};

	if (!isDragging) {
		return null;
	}

	return (
		<div className="terminal-drop-overlay">
			{/* Paste Path Zone (Top/Left) */}
			<div
				className={`drop-zone drop-zone-paste ${hoveredZone === 'paste' ? 'hovered' : ''}`}
				onDragEnter={() => setHoveredZone('paste')}
				onDrop={(e) => handleZoneDrop('paste', e)}
				onDragOver={(e) => e.preventDefault()}
			>
				<div className="drop-zone-content">
					<FileText size={48} />
					<h3>Paste Path</h3>
					<p>Insert file path into terminal</p>
				</div>
			</div>

			{/* Upload Here Zone (Bottom/Right) */}
			<div
				className={`drop-zone drop-zone-upload ${hoveredZone === 'upload' ? 'hovered' : ''}`}
				onDragEnter={() => setHoveredZone('upload')}
				onDrop={(e) => handleZoneDrop('upload', e)}
				onDragOver={(e) => e.preventDefault()}
			>
				<div className="drop-zone-content">
					<Upload size={48} />
					<h3>Upload Here</h3>
					<p>Upload file to current directory</p>
				</div>
			</div>
		</div>
	);
};
