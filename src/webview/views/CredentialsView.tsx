import React, { useState } from 'react';
import { Credential } from '../../common/types';
import vscode from '../utils/vscode';

interface CredentialsViewProps {
	credentials: Credential[];
}

const CredentialsView: React.FC<CredentialsViewProps> = ({ credentials }) => {
	const [isEditing, setIsEditing] = useState(false);
	const [editingCred, setEditingCred] = useState<Partial<Credential> & { secret?: string }>({});

	const handleAdd = () => {
		setEditingCred({ id: crypto.randomUUID(), type: 'password' });
		setIsEditing(true);
	};

	const handleEdit = (cred: Credential) => {
		setEditingCred({ ...cred, secret: '' }); // Don't fetch secret, user must re-enter if changing or just update metadata
		setIsEditing(true);
	};

	const handleDelete = (id: string) => {
		if (confirm('Are you sure you want to delete this credential?')) {
			vscode.postMessage({ command: 'DELETE_CREDENTIAL', payload: { id } });
		}
	};

	const handleSave = () => {
		if (!editingCred.name || !editingCred.username) {
			return; // Validation loop
		}

		const newCred: Credential = {
			id: editingCred.id || crypto.randomUUID(),
			name: editingCred.name,
			username: editingCred.username,
			type: editingCred.type || 'password',
			folder: editingCred.folder
		};

		// Secret is required for new credentials, optional for updates if not changed?
		// For simplicity, we might require it or handle it separately.
		// Let's assume if secret is provided, update it. If new, it's required.
		// But type 'key' might not have a secret if it's just a path?
		// Spec says "Identity" has type password/key.
		// If key, secret might be the passphrase or the key content? Usually key path is better for agent?
		// Re-reading spec: "Identity (Credential)... type (password/key)".
		// If key, maybe we store the key path in 'folder' or specific field?
		// Actually, let's treat 'secret' as the password or the passphrase/key content.

		vscode.postMessage({
			command: 'SAVE_CREDENTIAL',
			payload: {
				credential: newCred,
				secret: editingCred.secret || ''
			}
		});
		setIsEditing(false);
	};

	if (isEditing) {
		return (
			<div className="edit-host-container">
				<h2>{editingCred.id ? 'Edit Credential' : 'New Credential'}</h2>
				<div className="form-group">
					<label>Name</label>
					<input
						type="text"
						value={editingCred.name || ''}
						onChange={e => setEditingCred(p => ({ ...p, name: e.target.value }))}
						placeholder="e.g. Production Server"
					/>
				</div>
				<div className="form-group">
					<label>Username</label>
					<input
						type="text"
						value={editingCred.username || ''}
						onChange={e => setEditingCred(p => ({ ...p, username: e.target.value }))}
						placeholder="root"
					/>
				</div>
				<div className="form-group">
					<label>Type</label>
					<select
						value={editingCred.type || 'password'}
						onChange={e => setEditingCred(p => ({ ...p, type: e.target.value as any }))}
					>
						<option value="password">Password</option>
						<option value="key">Key File</option>
					</select>
				</div>
				<div className="form-group">
					<label>{editingCred.type === 'key' ? 'Key Passphrase (Optional)' : 'Password'}</label>
					<input
						type="password"
						value={editingCred.secret || ''}
						onChange={e => setEditingCred(p => ({ ...p, secret: e.target.value }))}
						placeholder={editingCred.type === 'key' ? 'Leave empty if no passphrase' : 'Password'}
					/>
				</div>
				<div className="form-group">
					<label>Folder (Optional)</label>
					<input
						type="text"
						value={editingCred.folder || ''}
						onChange={e => setEditingCred(p => ({ ...p, folder: e.target.value }))}
						placeholder="Folder name"
					/>
				</div>

				<div className="form-actions">
					<button className="primary-button" onClick={handleSave}>Save</button>
					<button className="secondary-button" onClick={() => setIsEditing(false)}>Cancel</button>
				</div>
			</div>
		);
	}

	return (
		<div className="credentials-view">
			<div className="toolbar">
				<button onClick={handleAdd} title="Add Credential">
					<i className="codicon codicon-add"></i> Add Credential
				</button>
			</div>
			<div className="list-container">
				{credentials.length === 0 ? (
					<div className="empty-state">No credentials found.</div>
				) : (
					credentials.map(cred => (
						<div key={cred.id} className="credential-item">
							<div className="cred-icon">
								<i className={`codicon codicon-${cred.type === 'key' ? 'key' : 'lock'}`}></i>
							</div>
							<div className="cred-details">
								<div className="cred-name">{cred.name}</div>
								<div className="cred-user">{cred.username}</div>
							</div>
							<div className="cred-actions">
								<button onClick={() => handleEdit(cred)} title="Edit">
									<i className="codicon codicon-edit"></i>
								</button>
								<button onClick={() => handleDelete(cred.id)} title="Delete">
									<i className="codicon codicon-trash"></i>
								</button>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
};

export default CredentialsView;
