import React from 'react';
import { Server, Plus, Key } from 'lucide-react';
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
				<Server size={16} />
				Hosts
			</button>
			<button
				className={activeView === 'addHost' ? 'active' : ''}
				onClick={() => onNavigate('addHost')}
			>
				<Plus size={16} />
				Add Host
			</button>
			<button
				className={activeView === 'credentials' ? 'active' : ''}
				onClick={() => onNavigate('credentials')}
			>
				<Key size={16} />
				Credentials
			</button>
		</div>
	);
};

export default TopNav;
