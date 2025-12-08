const path = require('path');

const extensionConfig = {
	name: 'extension',
	mode: 'development',
	target: 'node',
	entry: './src/extension/main.ts',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'extension.js',
		libraryTarget: 'commonjs',
	},
	externals: {
		'vscode': 'commonjs vscode',
		'ssh2': 'commonjs ssh2'
	},
	resolve: {
		extensions: ['.ts', '.js'],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
					},
				],
			},
		],
	},
	devtool: 'nosources-source-map',
};

const webviewConfig = {
	name: 'webview',
	mode: 'development',
	target: 'web',
	entry: './src/webview/index.tsx',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'webview.js',
	},
	resolve: {
		extensions: ['.ts', '.tsx', '.js'],
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
					},
				],
			},
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader'],
			},
		],
	},
	devtool: 'nosources-source-map',
};

module.exports = [extensionConfig, webviewConfig];
