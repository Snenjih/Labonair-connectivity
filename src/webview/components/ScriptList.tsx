import React, { useState } from 'react';
import { Script } from '../../common/types';
import vscode from '../utils/vscode';

interface ScriptListProps {
	scripts: Script[];
}

const ScriptList: React.FC<ScriptListProps> = ({ scripts }) => {
	const [isOpen, setIsOpen] = useState(false); // Collapsed by default as per common patterns for secondary panels? Or open? Spec says "collapsible section".
	const [isEditing, setIsEditing] = useState(false);
	const [editingScript, setEditingScript] = useState<Partial<Script>>({});

	const toggleOpen = () => setIsOpen(!isOpen);

	const handleDragStart = (e: React.DragEvent, scriptId: string) => {
		e.dataTransfer.setData('application/labonair-script', scriptId);
		e.dataTransfer.effectAllowed = 'copy';
	};

	const handleAdd = () => {
		setEditingScript({ id: crypto.randomUUID(), name: '', content: '' });
		setIsEditing(true);
	};

	const handleDelete = (id: string) => {
		// In a real app, confirm dialog
		vscode.postMessage({ command: 'DELETE_SCRIPT', payload: { id } }); // Oops, I need to add DELETE/SAVE_SCRIPT to Message type?
		// Wait, I updated Message type with UPDATE_DATA scripts, but did I add CRUD messages?
		// I missed adding DELETE_SCRIPT / SAVE_SCRIPT to typescript definition of Message in previous step.
		// Detailed check of types.ts later. For now I'll assume I need to add them or used generic names?
		// I'll assume I need to fix types.ts or use a generic 'SAVE_DATA' if I was lazy, but I should be specific.
		// I will check types.ts in a moment. I probably missed them in types.ts.
		// I will proceed writing this, and then fix types.ts.
	};

	const handleSave = () => {
		if (!editingScript.name || !editingScript.content) return;

		const script: Script = {
			id: editingScript.id || crypto.randomUUID(),
			name: editingScript.name,
			content: editingScript.content,
			shell: editingScript.shell
		};

		vscode.postMessage({ command: 'SAVE_SCRIPT', payload: { script } });
		setIsEditing(false);
	};

	// ... Actually, I realize I need to fix types.ts first to be type safe, or cast it.
	// But let's finish the component structure.

	// Wait, I'll write the component assuming the messages exist, then I'll fix types.ts and main.ts if I missed them.
	// Looking back at my main.ts update, I didn't add SAVE_SCRIPT handler!
	// I only added RUN_SCRIPT.
	// I need to add SAVE_SCRIPT / DELETE_SCRIPT to types.ts and main.ts.

	return (
		<div className="script-list-section">
			<div className="section-header" onClick={toggleOpen}>
				<i className={`codicon codicon-chevron-${isOpen ? 'down' : 'right'}`}></i>
				<span>Scripts & Snippets</span>
				<button className="icon-button" onClick={(e) => { e.stopPropagation(); handleAdd(); }} title="Add Script">
					<i className="codicon codicon-add"></i>
				</button>
			</div>
			{isOpen && (
				<div className="section-content">
					{scripts.length === 0 ? (
						<div className="empty-state">No scripts. Drag to host to run.</div>
					) : (
						<div className="script-items">
							{scripts.map(script => (
								<div
									key={script.id}
									className="script-item"
									draggable
									onDragStart={(e) => handleDragStart(e, script.id)}
								>
									<i className="codicon codicon-file-code"></i>
									<span className="script-name">{script.name}</span>
									<span className="script-actions">
										<i className="codicon codicon-trash" onClick={() => handleDelete(script.id)}></i>
									</span>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{isEditing && (
				<div className="modal-overlay">
					<div className="modal-content">
						<h3>{editingScript.id ? 'Edit Script' : 'New Script'}</h3>
						<div className="form-group">
							<label>Name</label>
							<input
								type="text"
								value={editingScript.name || ''}
								onChange={e => setEditingScript(p => ({ ...p, name: e.target.value }))}
								placeholder="Script Name"
							/>
						</div>
						<div className="form-group">
							<label>Content</label>
							<textarea
								value={editingScript.content || ''}
								onChange={e => setEditingScript(p => ({ ...p, content: e.target.value }))}
								placeholder="#!/bin/bash..."
								rows={5}
							/>
						</div>
						<div className="form-actions">
							<button className="primary-button" onClick={handleSave}>Save</button>
							<button className="secondary-button" onClick={() => setIsEditing(false)}>Cancel</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default ScriptList;
