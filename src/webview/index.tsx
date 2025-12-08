import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/main.css';
import App from './App';

const container = document.getElementById('root');
console.log('Found root container:', container);
if (container) {
	try {
		console.log('Mounting React App...');
		const root = createRoot(container);
		root.render(<App />);
		console.log('React App mounted');
	} catch (e) {
		console.error('Failed to mount React App:', e);
		container.innerText = 'React Error: ' + e;
	}
} else {
	console.error('Root container not found!');
	document.body.innerText = 'Root container not found';
}
