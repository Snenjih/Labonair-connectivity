import React from 'react';
import { DiskSpaceInfo, FileEntry } from '../../../common/types';

interface PanelStatusProps {
	files: FileEntry[];
	selectedFiles: FileEntry[];
	diskSpace: DiskSpaceInfo | null;
	isLoading: boolean;
}

/**
 * PanelStatus Component
 * Displays status information at the bottom of each file panel
 * Shows total items, selection stats, and disk space
 */
export const PanelStatus: React.FC<PanelStatusProps> = ({
	files,
	selectedFiles,
	diskSpace,
	isLoading
}) => {
	/**
	 * Formats bytes to human-readable format
	 */
	const formatBytes = (bytes: number, decimals: number = 2): string => {
		if (bytes === 0) {
			return '0 Bytes';
		}

		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
	};

	/**
	 * Calculates total size of selected files
	 */
	const calculateSelectedSize = (): number => {
		return selectedFiles.reduce((total, file) => {
			// Only count files, not directories
			if (file.type === '-') {
				return total + file.size;
			}
			return total;
		}, 0);
	};

	const totalItems = files.length;
	const selectedCount = selectedFiles.length;
	const selectedSize = calculateSelectedSize();
	const freeSpace = diskSpace ? diskSpace.free : 0;

	return (
		<div className="panel-status">
			{/* Left: Total Items */}
			<div className="panel-status-section panel-status-left">
				<span className="panel-status-label">
					{totalItems} {totalItems === 1 ? 'item' : 'items'}
				</span>
			</div>

			{/* Center: Selection Stats */}
			<div className="panel-status-section panel-status-center">
				{selectedCount > 0 ? (
					<span className="panel-status-label">
						{selectedCount} selected ({formatBytes(selectedSize)})
					</span>
				) : (
					<span className="panel-status-label panel-status-muted">
						No selection
					</span>
				)}
			</div>

			{/* Right: Disk Space */}
			<div className="panel-status-section panel-status-right">
				{isLoading ? (
					<span className="panel-status-label panel-status-muted">
						Loading...
					</span>
				) : diskSpace && freeSpace > 0 ? (
					<span className="panel-status-label">
						Free: {formatBytes(freeSpace)}
					</span>
				) : (
					<span className="panel-status-label panel-status-muted">
						Disk space unavailable
					</span>
				)}
			</div>
		</div>
	);
};
