import React, { useState } from 'react';
import { Lock, Key, Save, Plus, Search, Edit, Trash2, Folder } from 'lucide-react';
import { Credential } from '../../common/types';
import vscode from '../utils/vscode';

interface CredentialsViewProps {
	credentials: Credential[];
	onEdit?: (credential: Credential) => void;
}

const CredentialsView: React.FC<CredentialsViewProps> = ({ credentials, onEdit }) => {
	const [isEditing, setIsEditing] = useState(false);
	const [editingCred, setEditingCred] = useState<Partial<Credential> & { secret?: string }>({});
	const [searchQuery, setSearchQuery] = useState('');

	const handleAdd = () => {
		setEditingCred({ id: crypto.randomUUID(), type: 'password' });
		setIsEditing(true);
	};

	const handleEdit = (cred: Credential) => {
		setEditingCred({ ...cred, secret: '' });
		setIsEditing(true);
	};

	const handleDelete = (id: string) => {
		if (confirm('Are you sure you want to delete this credential?')) {
			vscode.postMessage({ command: 'DELETE_CREDENTIAL', payload: { id } });
		}
	};

	const handleSave = () => {
		if (!editingCred.name || !editingCred.username) {
			return;
		}

		const newCred: Credential = {
			id: editingCred.id || crypto.randomUUID(),
			name: editingCred.name,
			username: editingCred.username,
			type: editingCred.type || 'password',
			folder: editingCred.folder
		};

		vscode.postMessage({
			command: 'SAVE_CREDENTIAL',
			payload: {
				credential: newCred,
				secret: editingCred.secret || ''
			}
		});
		setIsEditing(false);
	};

	const filteredCredentials = credentials.filter(cred => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		return (
			cred.name.toLowerCase().includes(query) ||
			cred.username.toLowerCase().includes(query) ||
			(cred.folder?.toLowerCase().includes(query))
		);
	});

	// Editing form
	if (isEditing) {
		return (
			<div className="edit-host-view">
				<h2>{editingCred.id && credentials.find(c => c.id === editingCred.id) ? 'Edit Credential' : 'New Credential'}</h2>

				<div className="form-section">
					<div className="form-group">
						<label>Name</label>
						<input
							className="vscode-input"
							type="text"
							value={editingCred.name || ''}
							onChange={e => setEditingCred(p => ({ ...p, name: e.target.value }))}
							placeholder="e.g. Production Server Root"
						/>
					</div>

					<div className="form-group">
						<label>Username</label>
						<input
							className="vscode-input"
							type="text"
							value={editingCred.username || ''}
							onChange={e => setEditingCred(p => ({ ...p, username: e.target.value }))}
							placeholder="root"
						/>
					</div>

					<div className="form-group">
						<label>Type</label>
						<div className="segmented-control">
							<button
								type="button"
								className={editingCred.type === 'password' ? 'active' : ''}
								onClick={() => setEditingCred(p => ({ ...p, type: 'password' }))}
							>
								<Lock size={16} />
								Password
							</button>
							<button
								type="button"
								className={editingCred.type === 'key' ? 'active' : ''}
								onClick={() => setEditingCred(p => ({ ...p, type: 'key' }))}
							>
								<Key size={16} />
								Key File
							</button>
						</div>
					</div>

					<div className="form-group">
						<label>{editingCred.type === 'key' ? 'Key Passphrase (Optional)' : 'Password'}</label>
						<input
							className="vscode-input"
							type="password"
							value={editingCred.secret || ''}
							onChange={e => setEditingCred(p => ({ ...p, secret: e.target.value }))}
							placeholder={editingCred.type === 'key' ? 'Leave empty if no passphrase' : 'Password'}
						/>
					</div>

					<div className="form-group">
						<label>Folder (Optional)</label>
						<input
							className="vscode-input"
							type="text"
							value={editingCred.folder || ''}
							onChange={e => setEditingCred(p => ({ ...p, folder: e.target.value }))}
							placeholder="e.g. Production"
						/>
					</div>
				</div>

				<div className="form-actions">
					<button className="secondary-button" onClick={() => setIsEditing(false)}>Cancel</button>
					<button className="primary-button" onClick={handleSave}>
						<Save size={16} />
						Save Credential
					</button>
				</div>
			</div>
		);
	}

	// List view
	return (
		<div className="credentials-view">
			{/* Header with Add Button */}
			<div className="credentials-header">
				<div className="credentials-title">
					<h2>Credentials Vault</h2>
					<p className="subtitle">{credentials.length} credential{credentials.length !== 1 ? 's' : ''} stored securely</p>
				</div>
				<button className="add-credential-btn" onClick={handleAdd}>
					<Plus size={16} />
					Add Credential
				</button>
			</div>

			{/* Search */}
			{credentials.length > 0 && (
				<div className="search-bar">
					<Search size={16} className="search-icon" style={{ position: 'absolute', left: '28px', top: '50%', transform: 'translateY(-50%)', color: 'var(--terminus-text-muted)', pointerEvents: 'none' }} />
					<input
						type="text"
						placeholder="Search credentials..."
						value={searchQuery}
						onChange={e => setSearchQuery(e.target.value)}
					/>
				</div>
			)}

			{/* Credentials List */}
			<div className="list-container">
				{credentials.length === 0 ? (
					<div className="empty-state">
						<Key size={24} style={{ marginBottom: '16px', opacity: 0.5, color: 'var(--terminus-text-subtle)' }} />
						<h3>No Credentials Yet</h3>
						<p>Add your first credential to securely store passwords and SSH keys.</p>
						<button className="primary-button" onClick={handleAdd}>
							<Plus size={16} />
							Add Your First Credential
						</button>
					</div>
				) : filteredCredentials.length === 0 ? (
					<div className="empty-state">
						<Search size={24} style={{ marginBottom: '16px', opacity: 0.5, color: 'var(--terminus-text-subtle)' }} />
						<h3>No Results</h3>
						<p>No credentials match your search query.</p>
					</div>
				) : (
					<div className="credentials-grid">
						{filteredCredentials.map(cred => (
							<div key={cred.id} className="credential-card">
								<div className="cred-icon">
									{cred.type === 'key' ? <Key size={20} /> : <Lock size={20} />}
								</div>
								<div className="cred-details">
									<div className="cred-name">{cred.name}</div>
									<div className="cred-user">{cred.username}</div>
									{cred.folder && <div className="cred-folder"><Folder size={14} /> {cred.folder}</div>}
								</div>
								<div className="cred-type-badge">{cred.type === 'key' ? 'SSH Key' : 'Password'}</div>
								<div className="cred-actions">
									<button onClick={() => handleEdit(cred)} title="Edit">
										<Edit size={16} />
									</button>
									<button onClick={() => handleDelete(cred.id)} title="Delete" className="danger">
										<Trash2 size={16} />
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default CredentialsView;
