/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/extension/commands.ts":
/*!***********************************!*\
  !*** ./src/extension/commands.ts ***!
  \***********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.registerCommands = registerCommands;
const vscode = __importStar(__webpack_require__(/*! vscode */ "vscode"));
function registerCommands(context, hostService) {
    context.subscriptions.push(vscode.commands.registerCommand('labonair.quickConnect', async () => {
        const hosts = hostService.getHosts();
        const items = hosts.map(host => ({
            label: `$(server) ${host.name}`,
            description: `$(chevron-right) ${host.username}@${host.host}`,
            detail: host.group,
            picked: false,
            // store id in a way we can retrieve index or object
            // but QuickPickItem structure is strict.
            // We can augment it if we pass objects to showQuickPick assuming generic support, or just match by label/index.
        }));
        // To map back to host, we can look up by index or create a map. Using map for closure.
        const quickPickHostMap = new Map();
        items.forEach((item, index) => quickPickHostMap.set(item, hosts[index]));
        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a host to connect to',
            matchOnDescription: true,
            matchOnDetail: true
        });
        if (selection) {
            const host = quickPickHostMap.get(selection);
            if (host) {
                vscode.window.showInformationMessage(`Connecting to ${host.name}... (Stub)`);
                // In real implementation, trigger connection logic
            }
        }
    }));
}


/***/ }),

/***/ "./src/extension/credentialService.ts":
/*!********************************************!*\
  !*** ./src/extension/credentialService.ts ***!
  \********************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CredentialService = void 0;
const vscode = __importStar(__webpack_require__(/*! vscode */ "vscode"));
class CredentialService {
    constructor(context) {
        this.context = context;
        this.STORAGE_KEY = 'labonair.credentials.list';
        this._onDidChangeCredentials = new vscode.EventEmitter();
        this.onDidChangeCredentials = this._onDidChangeCredentials.event;
    }
    async getCredentials() {
        const data = this.context.globalState.get(this.STORAGE_KEY, []);
        return data;
    }
    async saveCredential(credential, secret) {
        const credentials = await this.getCredentials();
        const index = credentials.findIndex(c => c.id === credential.id);
        if (index !== -1) {
            credentials[index] = credential;
        }
        else {
            credentials.push(credential);
        }
        await this.context.globalState.update(this.STORAGE_KEY, credentials);
        await this.context.secrets.store(`labonair.credential.${credential.id}`, secret);
        this._onDidChangeCredentials.fire(credentials);
    }
    async deleteCredential(id) {
        let credentials = await this.getCredentials();
        credentials = credentials.filter(c => c.id !== id);
        await this.context.globalState.update(this.STORAGE_KEY, credentials);
        await this.context.secrets.delete(`labonair.credential.${id}`);
        this._onDidChangeCredentials.fire(credentials);
    }
    async getSecret(id) {
        return await this.context.secrets.get(`labonair.credential.${id}`);
    }
}
exports.CredentialService = CredentialService;


/***/ }),

/***/ "./src/extension/hostService.ts":
/*!**************************************!*\
  !*** ./src/extension/hostService.ts ***!
  \**************************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HostService = void 0;
class HostService {
    constructor(context) {
        this.STORAGE_KEY = 'labonair.hosts';
        this.GROUPS_KEY = 'labonair.groups';
        this.context = context;
    }
    getHosts() {
        return this.context.globalState.get(this.STORAGE_KEY, []);
    }
    getGroupConfigs() {
        return this.context.globalState.get(this.GROUPS_KEY, {});
    }
    async saveHost(host, password, keyPath) {
        const hosts = this.getHosts();
        const index = hosts.findIndex(h => h.id === host.id);
        if (index !== -1) {
            hosts[index] = host;
        }
        else {
            hosts.push(host);
        }
        await this.context.globalState.update(this.STORAGE_KEY, hosts);
        if (password) {
            await this.context.secrets.store(`pwd.${host.id}`, password);
        }
    }
    async updateLastUsed(hostId) {
        const hosts = this.getHosts();
        const hostIndex = hosts.findIndex(h => h.id === hostId);
        if (hostIndex !== -1) {
            hosts[hostIndex].lastUsed = Date.now();
            await this.context.globalState.update(this.STORAGE_KEY, hosts);
        }
    }
    async deleteHost(id) {
        const hosts = this.getHosts().filter(h => h.id !== id);
        await this.context.globalState.update(this.STORAGE_KEY, hosts);
        await this.context.secrets.delete(`pwd.${id}`);
    }
    async saveGroupConfig(config) {
        const groups = this.getGroupConfigs();
        groups[config.name] = config;
        await this.context.globalState.update(this.GROUPS_KEY, groups);
    }
    async getEffectiveConfig(hostId) {
        const hosts = this.getHosts();
        const host = hosts.find(h => h.id === hostId);
        if (!host) {
            throw new Error(`Host ${hostId} not found`);
        }
        // Defaults
        let effectiveHost = { ...host };
        if (host.group) {
            const groups = this.getGroupConfigs();
            const groupConfig = groups[host.group];
            if (groupConfig) {
                if (!effectiveHost.username && groupConfig.username) {
                    effectiveHost.username = groupConfig.username;
                }
                if (!effectiveHost.port && groupConfig.port) {
                    effectiveHost.port = groupConfig.port;
                }
                if (!effectiveHost.credentialId && groupConfig.credentialId) {
                    effectiveHost.credentialId = groupConfig.credentialId;
                }
            }
        }
        return effectiveHost;
    }
}
exports.HostService = HostService;


/***/ }),

/***/ "./src/extension/importers.ts":
/*!************************************!*\
  !*** ./src/extension/importers.ts ***!
  \************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ImporterService = void 0;
const vscode = __importStar(__webpack_require__(/*! vscode */ "vscode"));
const fs = __importStar(__webpack_require__(/*! fs */ "fs"));
class ImporterService {
    async importHosts(format) {
        const options = {
            canSelectMany: false,
            openLabel: 'Import'
        };
        if (format === 'json') {
            options.filters = { 'JSON': ['json'] };
        }
        else {
            options.filters = { 'SSH Config': ['config', 'conf', 'ssh_config'] };
        }
        const fileUri = await vscode.window.showOpenDialog(options);
        if (!fileUri || fileUri.length === 0) {
            return [];
        }
        const content = await fs.promises.readFile(fileUri[0].fsPath, 'utf8');
        if (format === 'json') {
            try {
                return JSON.parse(content);
            }
            catch (e) {
                vscode.window.showErrorMessage('Failed to parse JSON file');
                return [];
            }
        }
        else {
            return this.parseSSHConfig(content);
        }
    }
    async exportHosts(hosts) {
        const fileUri = await vscode.window.showSaveDialog({
            filters: { 'JSON': ['json'] },
            saveLabel: 'Export'
        });
        if (!fileUri) {
            return;
        }
        await fs.promises.writeFile(fileUri.fsPath, JSON.stringify(hosts, null, 2), 'utf8');
        vscode.window.showInformationMessage('Hosts exported successfully');
    }
    parseSSHConfig(content) {
        const hosts = [];
        const lines = content.split('\n');
        let currentHost = null;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            // Simple parser: first word key, rest value
            const parts = trimmed.split(/\s+/);
            const key = parts[0].toLowerCase();
            const value = parts.slice(1).join(' ');
            if (key === 'host') {
                if (currentHost && currentHost.name) {
                    hosts.push(currentHost);
                }
                currentHost = {
                    id: crypto.randomUUID(),
                    name: value, // Use pattern as name for now
                    host: value, // Default to pattern if HostName missing
                    port: 22,
                    username: 'root', // Default
                    osIcon: 'linux',
                    group: 'Imported',
                    tags: []
                };
            }
            else if (currentHost) {
                switch (key) {
                    case 'hostname':
                        currentHost.host = value;
                        break;
                    case 'user':
                        currentHost.username = value;
                        break;
                    case 'port':
                        currentHost.port = parseInt(value) || 22;
                        break;
                    case 'identityfile':
                        // Store in notes or a separate field if needed, but for now we don't map IdentityFile to keys directly in Host object unless we want to pre-fill KeyPath.
                        // However, Host object doesn't persist key path. It's separate.
                        // For this iteration, we ignore it or add to notes.
                        currentHost.notes = (currentHost.notes || '') + `IdentityFile: ${value}\n`;
                        break;
                }
            }
        }
        if (currentHost && currentHost.name) {
            hosts.push(currentHost);
        }
        return hosts;
    }
}
exports.ImporterService = ImporterService;


/***/ }),

/***/ "./src/extension/main.ts":
/*!*******************************!*\
  !*** ./src/extension/main.ts ***!
  \*******************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
const hostKeyService_1 = __webpack_require__(/*! ./security/hostKeyService */ "./src/extension/security/hostKeyService.ts");
// import { Utils } from 'vscode-uri'; // Removed unused import causing build error
const vscode = __importStar(__webpack_require__(/*! vscode */ "vscode"));
const hostService_1 = __webpack_require__(/*! ./hostService */ "./src/extension/hostService.ts");
const credentialService_1 = __webpack_require__(/*! ./credentialService */ "./src/extension/credentialService.ts");
const scriptService_1 = __webpack_require__(/*! ./scriptService */ "./src/extension/scriptService.ts");
const sessionTracker_1 = __webpack_require__(/*! ./sessionTracker */ "./src/extension/sessionTracker.ts");
const sshAgent_1 = __webpack_require__(/*! ./sshAgent */ "./src/extension/sshAgent.ts");
const shellService_1 = __webpack_require__(/*! ./system/shellService */ "./src/extension/system/shellService.ts");
const importers_1 = __webpack_require__(/*! ./importers */ "./src/extension/importers.ts");
const commands_1 = __webpack_require__(/*! ./commands */ "./src/extension/commands.ts");
function activate(context) {
    const hostService = new hostService_1.HostService(context);
    const credentialService = new credentialService_1.CredentialService(context);
    const scriptService = new scriptService_1.ScriptService(context);
    const sessionTracker = new sessionTracker_1.SessionTracker(context);
    const sshAgentService = new sshAgent_1.SshAgentService(context);
    const importerService = new importers_1.ImporterService();
    // Register Commands
    const hostKeyService = new hostKeyService_1.HostKeyService();
    const shellService = new shellService_1.ShellService();
    // Register Commands
    (0, commands_1.registerCommands)(context, hostService);
    // Register the Webview View Provider
    try {
        console.log('Activating Connectivity Extension...');
        const provider = new ConnectivityViewProvider(context.extensionUri, hostService, credentialService, scriptService, sessionTracker, sshAgentService, importerService, hostKeyService, shellService);
        context.subscriptions.push(vscode.window.registerWebviewViewProvider('labonair.views.hosts', provider));
        console.log('Connectivity Extension Activated Successfully.');
    }
    catch (e) {
        console.error('Failed to activate Connectivity Extension:', e);
        vscode.window.showErrorMessage('Failed to activate Connectivity Extension: ' + e);
    }
}
class ConnectivityViewProvider {
    constructor(_extensionUri, _hostService, _credentialService, _scriptService, _sessionTracker, _sshAgentService, _importerService, _hostKeyService, _shellService) {
        this._extensionUri = _extensionUri;
        this._hostService = _hostService;
        this._credentialService = _credentialService;
        this._scriptService = _scriptService;
        this._sessionTracker = _sessionTracker;
        this._sshAgentService = _sshAgentService;
        this._importerService = _importerService;
        this._hostKeyService = _hostKeyService;
        this._shellService = _shellService;
    }
    resolveWebviewView(webviewView, context, _token) {
        console.log('ConnectivityViewProvider.resolveWebviewView called');
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        console.log('Webview HTML set');
        // Listen for credential updates
        this._credentialService.onDidChangeCredentials(credentials => {
            webviewView.webview.postMessage({ command: 'UPDATE_DATA', payload: { credentials } });
        });
        // Listen for script updates
        this._scriptService.onDidChangeScripts(scripts => {
            webviewView.webview.postMessage({ command: 'UPDATE_DATA', payload: { scripts } });
        });
        // Listen for session updates
        this._sessionTracker.onDidChangeSessions(activeHostIds => {
            webviewView.webview.postMessage({ command: 'SESSION_UPDATE', payload: { activeHostIds } });
        });
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'FETCH_DATA':
                    // ... fetch data
                    const hosts = this._hostService.getHosts();
                    const credentials = await this._credentialService.getCredentials();
                    const scripts = await this._scriptService.getScripts();
                    const activeHostIds = this._sessionTracker.getActiveHostIds();
                    webviewView.webview.postMessage({
                        command: 'UPDATE_DATA',
                        payload: { hosts, credentials, scripts, activeSessionHostIds: activeHostIds }
                    });
                    // Also check SSH Agent
                    const agentAvailable = await this._sshAgentService.isAgentAvailable();
                    webviewView.webview.postMessage({ command: 'AGENT_STATUS', payload: { available: agentAvailable } });
                    // Get Shells
                    const shells = await this._shellService.getAvailableShells();
                    webviewView.webview.postMessage({ command: 'AVAILABLE_SHELLS', payload: { shells } });
                    break;
                case 'SAVE_HOST':
                    await this._hostService.saveHost(message.payload.host, message.payload.password, message.payload.keyPath);
                    this.broadcastUpdate();
                    break;
                case 'DELETE_HOST':
                    await this._hostService.deleteHost(message.payload.id);
                    this.broadcastUpdate();
                    break;
                    break;
                case 'CONNECT_SSH':
                    let hostToConnect;
                    if (message.payload.id) {
                        hostToConnect = this._hostService.getHosts().find(h => h.id === message.payload.id);
                    }
                    else if (message.payload.host) {
                        hostToConnect = message.payload.host;
                    }
                    if (!hostToConnect) {
                        vscode.window.showErrorMessage("Host not found.");
                        return;
                    }
                    vscode.window.showInformationMessage(`Connecting to ${hostToConnect.name || hostToConnect.host}...`);
                    // Host Key Verification
                    // Mock key for simulation.
                    const mockKey = Buffer.from('mock-public-key-' + hostToConnect.host);
                    const verificationStatus = await this._hostKeyService.verifyHostKey(hostToConnect.host, hostToConnect.port, 'ssh-rsa', mockKey);
                    if (verificationStatus !== 'valid') {
                        // Ask user to verify
                        webviewView.webview.postMessage({
                            command: 'CHECK_HOST_KEY',
                            payload: {
                                host: hostToConnect.host,
                                port: hostToConnect.port,
                                fingerprint: mockKey.toString('base64'),
                                status: verificationStatus
                            }
                        });
                        // We need to store the pending host to continue after acceptance.
                        // Currently ACCEPT_HOST_KEY handler tries to refind it.
                        // We might need to handle ad-hoc continuation.
                        // For now, let's assume ACCEPT_HOST_KEY works by finding host/port.
                        return;
                    }
                    // Proceed if valid
                    this.startSession(hostToConnect);
                    break;
                case 'ACCEPT_HOST_KEY':
                    if (message.payload.save) {
                        const keyBuffer = Buffer.from(message.payload.fingerprint, 'base64');
                        await this._hostKeyService.addHostKey(message.payload.host, message.payload.port, 'ssh-rsa', keyBuffer);
                    }
                    // Retry connection
                    // For ad-hoc, we don't have the object here easily unless we reconstructed it or stored it.
                    // Let's try to find it in store first.
                    const existingHost = this._hostService.getHosts().find(h => h.host === message.payload.host && h.port === message.payload.port);
                    if (existingHost) {
                        this.startSession(existingHost);
                    }
                    else {
                        // It might be ad-hoc.
                        // Simple workaround: We don't have the full host object (credentials, etc) here to restart ad-hoc session fully
                        // unless we passed it back and forth.
                        // For this iteration, we'll show a message asking user to click connect again.
                        vscode.window.showInformationMessage("Host key accepted. Please click connect again.");
                    }
                    break;
                case 'DENY_HOST_KEY':
                    vscode.window.showWarningMessage('Connection aborted by user.');
                    break;
                case 'PICK_KEY_FILE':
                    const uris = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectFolders: false });
                    if (uris && uris.length > 0) {
                        webviewView.webview.postMessage({ command: 'KEY_FILE_PICKED', payload: { path: uris[0].fsPath } });
                    }
                    break;
                case 'IMPORT_REQUEST':
                    const imported = await this._importerService.importHosts(message.payload.format);
                    if (imported && imported.length > 0) {
                        for (const h of imported) {
                            await this._hostService.saveHost(h);
                        }
                        this.broadcastUpdate();
                        vscode.window.showInformationMessage(`Imported ${imported.length} hosts.`);
                    }
                    break;
                case 'EXPORT_REQUEST':
                    const currentHosts = this._hostService.getHosts();
                    await this._importerService.exportHosts(currentHosts);
                    break;
                case 'GET_CREDENTIALS':
                    const creds = await this._credentialService.getCredentials();
                    webviewView.webview.postMessage({ command: 'UPDATE_DATA', payload: { hosts: this._hostService.getHosts(), credentials: creds } });
                    break;
                case 'SAVE_CREDENTIAL':
                    await this._credentialService.saveCredential(message.payload.credential, message.payload.secret);
                    this.broadcastUpdate();
                    break;
                case 'DELETE_CREDENTIAL':
                    await this._credentialService.deleteCredential(message.payload.id);
                    this.broadcastUpdate();
                    break;
                case 'RUN_SCRIPT':
                    const scriptId = message.payload.scriptId;
                    const hostId = message.payload.hostId;
                    const allScripts = await this._scriptService.getScripts();
                    const script = allScripts.find(s => s.id === scriptId);
                    if (script) {
                        vscode.window.showInformationMessage(`Simulating sending script "${script.name}" to host ${hostId}`);
                        // Actual implementation will connect to host and send script
                    }
                    break;
                case 'SAVE_SCRIPT':
                    await this._scriptService.saveScript(message.payload.script);
                    this.broadcastUpdate();
                    break;
                case 'DELETE_SCRIPT':
                    await this._scriptService.deleteScript(message.payload.id);
                    break;
            }
        });
    }
    async startSession(host) {
        const term = vscode.window.createTerminal(`SSH: ${host.name || host.host}`);
        term.show();
        this._sessionTracker.registerSession(host.id, term);
        // If it's a saved host, update last used
        const isSaved = this._hostService.getHosts().some(h => h.id === host.id);
        if (isSaved) {
            await this._hostService.updateLastUsed(host.id);
        }
        else {
            // Ad-hoc: Offer to save
            const selection = await vscode.window.showInformationMessage(`Connected to ${host.host}. Save this connection?`, 'Yes', 'No');
            if (selection === 'Yes') {
                // We can reuse SAVE_HOST logic if we strip ID? Or keep ID?
                // Just call saveHost
                await this._hostService.saveHost(host);
                vscode.window.showInformationMessage("Host saved.");
                this.broadcastUpdate();
            }
        }
        this.broadcastUpdate();
    }
    async broadcastUpdate() {
        if (this._view) {
            const hosts = this._hostService.getHosts();
            const credentials = await this._credentialService.getCredentials();
            const scripts = await this._scriptService.getScripts();
            const activeHostIds = this._sessionTracker.getActiveHostIds();
            this._view.webview.postMessage({ command: 'UPDATE_DATA', payload: { hosts, credentials, scripts, activeSessionHostIds: activeHostIds } });
        }
    }
    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'styles', 'main.css')); // Keep for now if needed, but style-loader should handle it.
        const nonce = getNonce();
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Labonair Connectivity</title>
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}


/***/ }),

/***/ "./src/extension/scriptService.ts":
/*!****************************************!*\
  !*** ./src/extension/scriptService.ts ***!
  \****************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ScriptService = void 0;
const vscode = __importStar(__webpack_require__(/*! vscode */ "vscode"));
class ScriptService {
    constructor(context) {
        this.context = context;
        this.STORAGE_KEY = 'labonair.scripts';
        this._onDidChangeScripts = new vscode.EventEmitter();
        this.onDidChangeScripts = this._onDidChangeScripts.event;
    }
    async getScripts() {
        return this.context.globalState.get(this.STORAGE_KEY, []);
    }
    async saveScript(script) {
        const scripts = await this.getScripts();
        const index = scripts.findIndex(s => s.id === script.id);
        if (index !== -1) {
            scripts[index] = script;
        }
        else {
            scripts.push(script);
        }
        await this.context.globalState.update(this.STORAGE_KEY, scripts);
        this._onDidChangeScripts.fire(scripts);
    }
    async deleteScript(id) {
        let scripts = await this.getScripts();
        scripts = scripts.filter(s => s.id !== id);
        await this.context.globalState.update(this.STORAGE_KEY, scripts);
        this._onDidChangeScripts.fire(scripts);
    }
}
exports.ScriptService = ScriptService;


/***/ }),

/***/ "./src/extension/security/hostKeyService.ts":
/*!**************************************************!*\
  !*** ./src/extension/security/hostKeyService.ts ***!
  \**************************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HostKeyService = void 0;
const fs = __importStar(__webpack_require__(/*! fs */ "fs"));
const path = __importStar(__webpack_require__(/*! path */ "path"));
const os = __importStar(__webpack_require__(/*! os */ "os"));
// @ts-ignore
// import * as ssh2 from 'ssh2';
class HostKeyService {
    constructor() {
        this.knownHostsPath = path.join(os.homedir(), '.ssh', 'known_hosts');
    }
    getSsh2() {
        return null;
        /*
        try {
            // @ts-ignore
            return require('ssh2');
        } catch (e) {
            console.error('Failed to load ssh2:', e);
            return null;
        }
        */
    }
    async verifyHostKey(host, port, keyAlgo, key) {
        // Basic implementation: read known_hosts manually for now or use ssh2's utils if available.
        // Note: ssh2 doesn't export a high-level known_hosts parser easily in this version.
        // For simplicity/robustness in this context, we'll check if we can parse it line by line.
        // Example usage if we needed ssh2:
        const ssh2 = this.getSsh2();
        if (!ssh2) {
            // Fallback or verify we don't strictly need it for *parsing* text files.
            // But if we used it for hashing/etc, we'd need it.
        }
        if (!fs.existsSync(this.knownHostsPath)) {
            return 'unknown';
        }
        const content = fs.readFileSync(this.knownHostsPath, 'utf8');
        const lines = content.split(/\r?\n/);
        const fingerprint = key.toString('base64');
        const entryPrefix = `[${host}]:${port}`; // rudimentary check, standard compliant parsing is complex
        // Check for exact matches
        for (const line of lines) {
            if (line.startsWith(entryPrefix) || line.startsWith(host)) {
                // Found a matching host entry
                if (line.includes(fingerprint)) {
                    return 'valid';
                }
                else {
                    // Host matches but key differs -> Potential MITM or Changed Key
                    // We need to be careful about unrelated keys (ecdsa vs rsa) for same host
                    // But if we find a mismatch for the *same type* it is invalid.
                    // For now, if we see the host but not this key, return invalid to prompt user.
                    // Ideally we check key type too.
                    return 'invalid';
                }
            }
        }
        return 'unknown';
    }
    async addHostKey(host, port, keyAlgo, key) {
        const entry = `[${host}]:${port} ${keyAlgo} ${key.toString('base64')}\n`;
        if (!fs.existsSync(path.dirname(this.knownHostsPath))) {
            fs.mkdirSync(path.dirname(this.knownHostsPath), { recursive: true });
        }
        fs.appendFileSync(this.knownHostsPath, entry);
    }
}
exports.HostKeyService = HostKeyService;


/***/ }),

/***/ "./src/extension/sessionTracker.ts":
/*!*****************************************!*\
  !*** ./src/extension/sessionTracker.ts ***!
  \*****************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SessionTracker = void 0;
const vscode = __importStar(__webpack_require__(/*! vscode */ "vscode"));
class SessionTracker {
    constructor(context) {
        this.context = context;
        this.activeSessions = new Map();
        this._onDidChangeSessions = new vscode.EventEmitter();
        this.onDidChangeSessions = this._onDidChangeSessions.event;
        vscode.window.onDidCloseTerminal(term => {
            if (this.activeSessions.has(term)) {
                this.activeSessions.delete(term);
                this.fireUpdate();
            }
        });
    }
    registerSession(hostId, terminal) {
        this.activeSessions.set(terminal, hostId);
        this.fireUpdate();
    }
    getActiveHostIds() {
        return Array.from(this.activeSessions.values());
    }
    fireUpdate() {
        this._onDidChangeSessions.fire(this.getActiveHostIds());
    }
}
exports.SessionTracker = SessionTracker;


/***/ }),

/***/ "./src/extension/sshAgent.ts":
/*!***********************************!*\
  !*** ./src/extension/sshAgent.ts ***!
  \***********************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SshAgentService = void 0;
const net = __importStar(__webpack_require__(/*! net */ "net"));
const os = __importStar(__webpack_require__(/*! os */ "os"));
class SshAgentService {
    constructor(context) {
        this.context = context;
    }
    async isAgentAvailable() {
        const sockPath = process.env.SSH_AUTH_SOCK;
        const isWin = os.platform() === 'win32';
        if (isWin) {
            return new Promise(resolve => {
                const pipePath = '\\\\.\\pipe\\openssh-ssh-agent';
                const client = net.connect(pipePath, () => {
                    client.end();
                    resolve(true);
                });
                client.on('error', () => resolve(false));
            });
        }
        else {
            if (!sockPath)
                return false;
            return new Promise(resolve => {
                const client = net.connect(sockPath, () => {
                    client.end();
                    resolve(true);
                });
                client.on('error', () => resolve(false));
            });
        }
    }
}
exports.SshAgentService = SshAgentService;


/***/ }),

/***/ "./src/extension/system/shellService.ts":
/*!**********************************************!*\
  !*** ./src/extension/system/shellService.ts ***!
  \**********************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ShellService = void 0;
const os = __importStar(__webpack_require__(/*! os */ "os"));
const cp = __importStar(__webpack_require__(/*! child_process */ "child_process"));
const util = __importStar(__webpack_require__(/*! util */ "util"));
const exec = util.promisify(cp.exec);
class ShellService {
    async getAvailableShells() {
        const platform = os.platform();
        const shells = [];
        if (platform === 'win32') {
            shells.push('powershell.exe', 'cmd.exe');
            // Detect Git Bash
            try {
                await exec('git --version');
                // Common path, or assume user adds it to PATH
                shells.push('git-bash.exe');
            }
            catch (e) { /* ignore */ }
            // Detect WSL distros
            try {
                const { stdout } = await exec('wsl -l -q');
                // Output is UTF-16 usually on Windows, need care?
                // wsl -l -q outputs distro names separated by newlines/CRs
                // But Node's exec decodes it reasonably well usually.
                const lines = stdout.toString().split(/\r?\n/).filter(line => line.trim() !== '');
                // remove UTF-16 artifacts if any (like null bytes)
                const distros = lines.map(l => l.replace(/\0/g, '').trim()).filter(l => l.length > 0);
                distros.forEach(d => shells.push(`WSL: ${d}`));
            }
            catch (e) {
                console.error('Error listing WSL:', e);
            }
        }
        else {
            // Mac/Linux
            shells.push('/bin/bash', '/bin/zsh');
            // standard check
            if (platform === 'darwin') {
                // Maybe look for others
            }
        }
        return shells;
    }
}
exports.ShellService = ShellService;


/***/ }),

/***/ "child_process":
/*!********************************!*\
  !*** external "child_process" ***!
  \********************************/
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ "net":
/*!**********************!*\
  !*** external "net" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("net");

/***/ }),

/***/ "os":
/*!*********************!*\
  !*** external "os" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("path");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ "vscode":
/*!*************************!*\
  !*** external "vscode" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("vscode");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/extension/main.ts");
/******/ 	var __webpack_export_target__ = exports;
/******/ 	for(var __webpack_i__ in __webpack_exports__) __webpack_export_target__[__webpack_i__] = __webpack_exports__[__webpack_i__];
/******/ 	if(__webpack_exports__.__esModule) Object.defineProperty(__webpack_export_target__, "__esModule", { value: true });
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map