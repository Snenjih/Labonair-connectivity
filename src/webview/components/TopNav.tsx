import React from 'react';

interface TopNavProps {
	activeView: 'list' | 'edit' | 'credentials';
	onNavigate: (view: 'list' | 'edit' | 'credentials') => void;
}

const TopNav: React.FC<TopNavProps> = ({ activeView, onNavigate }) => {
	return (
		<div className="top-nav">
			<button
				className={activeView === 'list' ? 'active' : ''}
				onClick={() => onNavigate('list')}
			>
				Host Viewer
			</button>
			<button
				className={activeView === 'edit' ? 'active' : ''}
				onClick={() => onNavigate('edit')}
			>
				Add Host
			</button>
			<button
				className={activeView === 'credentials' ? 'active' : ''}
				onClick={() => onNavigate('credentials')}
			>
				Credentials
			</button>
		</div>
	);
};

export default TopNav;
