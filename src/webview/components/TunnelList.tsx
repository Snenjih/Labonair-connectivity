import React from 'react';
import { Tunnel } from '../../common/types';
import '../styles/forms.css';

interface TunnelListProps {
	tunnels: Tunnel[];
	onChange: (tunnels: Tunnel[]) => void;
}

export const TunnelList: React.FC<TunnelListProps> = ({ tunnels, onChange }) => {
	const addTunnel = () => {
		onChange([...tunnels, { type: 'local', srcPort: 8080, dstHost: 'localhost', dstPort: 80 }]);
	};

	const removeTunnel = (index: number) => {
		onChange(tunnels.filter((_, i) => i !== index));
	};

	const updateTunnel = (index: number, field: keyof Tunnel, value: any) => {
		const newTunnels = [...tunnels];
		newTunnels[index] = { ...newTunnels[index], [field]: value };
		onChange(newTunnels);
	};

	return (
		<div className="tunnel-list">
			<div className="tunnel-header">
				<span>Type</span>
				<span>Src Port</span>
				<span>Dest Host</span>
				<span>Dest Port</span>
				<span>Action</span>
			</div>
			{tunnels.map((tunnel, index) => (
				<div key={index} className="tunnel-row">
					<select
						value={tunnel.type}
						onChange={e => updateTunnel(index, 'type', e.target.value)}
						className="vscode-input"
					>
						<option value="local">Local</option>
						<option value="remote">Remote</option>
					</select>
					<input
						type="number"
						value={tunnel.srcPort}
						onChange={e => updateTunnel(index, 'srcPort', parseInt(e.target.value))}
						className="vscode-input"
					/>
					<input
						type="text"
						value={tunnel.dstHost}
						onChange={e => updateTunnel(index, 'dstHost', e.target.value)}
						className="vscode-input"
					/>
					<input
						type="number"
						value={tunnel.dstPort}
						onChange={e => updateTunnel(index, 'dstPort', parseInt(e.target.value))}
						className="vscode-input"
					/>
					<button type="button" onClick={() => removeTunnel(index)} className="vscode-button secondary">
						Remove
					</button>
				</div>
			))}
			<button type="button" onClick={addTunnel} className="vscode-button">
				Add Tunnel
			</button>
		</div>
	);
};
