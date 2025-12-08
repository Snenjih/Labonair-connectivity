import { Message } from '../../common/types';

declare const acquireVsCodeApi: () => {
	postMessage: (message: Message) => void;
	getState: () => any;
	setState: (state: any) => void;
};

const vscode = acquireVsCodeApi();

export default vscode;
