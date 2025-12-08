import React from 'react';

const EmptyState: React.FC = () => {
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
			<i className="codicon codicon-server-environment" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}></i>
			<h3 style={{ margin: '0 0 8px 0', color: 'var(--vscode-foreground)' }}>No Hosts Found</h3>
			<p style={{ margin: 0, maxWidth: '300px' }}>
				Get started by adding a new host manually or importing your existing SSH configuration.
			</p>
		</div>
	);
};

export default EmptyState;
