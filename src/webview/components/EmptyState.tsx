import React from 'react';
import { Server, Plus } from 'lucide-react';

interface EmptyStateProps {
	onCreateHost?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onCreateHost }) => {
	return (
		<div className="empty-state" style={{
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			padding: '40px',
			textAlign: 'center',
			color: 'var(--vscode-descriptionForeground)'
		}}>
			<Server size={48} style={{ marginBottom: '24px', opacity: 0.5, color: 'var(--terminus-text-subtle)' }} />
			<h3 style={{ margin: '0 0 8px 0', color: 'var(--vscode-foreground)' }}>No Hosts Found</h3>
			<p style={{ margin: '0 0 24px 0', maxWidth: '300px' }}>
				Use the "New Host" button above to get started, or import your existing SSH configuration.
			</p>
			{onCreateHost && (
				<button
					onClick={onCreateHost}
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						padding: '12px 24px',
						backgroundColor: 'var(--vscode-button-background)',
						color: 'var(--vscode-button-foreground)',
						border: 'none',
						borderRadius: 'var(--terminus-radius-md)',
						fontSize: '14px',
						fontWeight: 500,
						cursor: 'pointer',
						transition: 'background-color 0.15s ease'
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
					}}
				>
					<Plus size={18} />
					Create Host
				</button>
			)}
		</div>
	);
};

export default EmptyState;
