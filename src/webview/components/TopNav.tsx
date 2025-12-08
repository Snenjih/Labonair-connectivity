import React from 'react';
import { ViewType } from '../../common/types';

interface TopNavProps {
	activeView: ViewType;
	onNavigate: (view: ViewType) => void;
}

const TopNav: React.FC<TopNavProps> = ({ activeView, onNavigate }) => {
	return (
		<div className="top-nav">
			<button
				className={activeView === 'hosts' ? 'active' : ''}
				onClick={() => onNavigate('hosts')}
			>
				<i className="codicon codicon-server"></i>
				Hosts
			</button>
			<button
				className={activeView === 'addHost' ? 'active' : ''}
				onClick={() => onNavigate('addHost')}
			>
				<i className="codicon codicon-add"></i>
				Add Host
			</button>
			<button
				className={activeView === 'credentials' ? 'active' : ''}
				onClick={() => onNavigate('credentials')}
			>
				<i className="codicon codicon-key"></i>
				Credentials
			</button>
		</div>
	);
};

export default TopNav;
