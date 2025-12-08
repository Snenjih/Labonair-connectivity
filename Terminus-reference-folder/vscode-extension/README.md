# Terminus VS Code Extension

Professional SSH server management with terminal access, tunneling, and file management - integrated directly into VS Code.

## Features

- **Native TreeView**: SSH hosts organized by folders in the VS Code Activity Bar
- **Terminal Access**: Full-featured SSH terminal sessions with PTY support
- **File Manager**: Browse and manage remote files with drag-and-drop support
- **SSH Tunnels**: Create and manage local/remote port forwarding
- **Quick Connect**: Command Palette integration for fast host connections
- **Single-Session Mode**: Each host opens in its own editor tab
- **Secure Storage**: Credentials stored using VS Code's SecretStorage API
- **Multi-Platform**: Platform-specific builds for Windows, Linux, macOS (x64 & ARM64)

## Installation

### From VS Code Marketplace

Search for "Terminus" in the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`) and click Install.

### From VSIX Package

Download the platform-specific `.vsix` file for your system from [GitHub Releases](https://github.com/snenjih/terminus/releases):

- **Windows**: `terminus-vscode-x.x.x-win32-x64.vsix`
- **Linux**: `terminus-vscode-x.x.x-linux-x64.vsix`
- **macOS Intel**: `terminus-vscode-x.x.x-darwin-x64.vsix`
- **macOS Apple Silicon**: `terminus-vscode-x.x.x-darwin-arm64.vsix`

Install via command line:
```bash
code --install-extension terminus-vscode-x.x.x-<platform>.vsix
```

Or via VS Code:
1. Open Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Click "..." menu → "Install from VSIX..."
3. Select the downloaded `.vsix` file

## Quick Start

1. **Open the Terminus view**: Click the Terminus icon in the Activity Bar (left sidebar)
2. **Add a host**: Click the "+" button in the Terminus view
3. **Connect**: Click on a host to open a terminal session in a new editor tab

## Usage

### Host Management

- **Add Host**: Click "+" in the Terminus view or use Command Palette (`Terminus: Add New Host`)
- **Edit Host**: Right-click host → "Edit Host"
- **Delete Host**: Right-click host → "Delete Host"
- **Quick Connect**: Command Palette → `Terminus: Quick Connect` → Select host

### Terminal Sessions

Each host opens in a dedicated editor tab with three views:
- **Terminal**: Full SSH terminal with PTY support
- **Files**: Remote file browser and manager
- **Tunnels**: SSH tunnel creation and monitoring

### Context Menu Actions

Right-click any host in the TreeView for quick actions:
- Open Host (terminal session)
- Edit Host configuration
- Duplicate Host
- Export Host config (JSON)
- Create SSH Tunnel
- Delete Host

## Data Storage

The extension stores data in VS Code's secure storage locations:

### Sensitive Data (SecretStorage API)
- JWT secrets
- Database encryption keys
- Internal authentication tokens

### Non-Sensitive Data (globalStorage)
- SQLite database: `<globalStorage>/snenjih.terminus-vscode/terminus-data/terminus.db`
- Upload temp directory: `<globalStorage>/snenjih.terminus-vscode/terminus-data/uploads/`

**Platform-specific locations:**
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/snenjih.terminus-vscode/`
- **Linux**: `~/.config/Code/User/globalStorage/snenjih.terminus-vscode/`
- **Windows**: `%APPDATA%\Code\User\globalStorage\snenjih.terminus-vscode\`

## Configuration

Configure the extension via VS Code Settings (`File` → `Preferences` → `Settings`):

- `terminus.backendPort`: Backend server port (default: 30001)
- `terminus.autoRestart`: Auto-restart backend on crash (default: true)
- `terminus.maxRestarts`: Maximum restart attempts (default: 3)
- `terminus.healthCheckInterval`: Health check interval in ms (default: 30000)

## Troubleshooting

### Backend Not Starting

1. Check VS Code Output panel → "Terminus Backend"
2. Verify ports 30001-30006 are not in use: `lsof -i :30001`
3. Restart VS Code
4. Check globalStorage directory permissions

### Native Module Errors

The extension requires `node-pty` and `better-sqlite3` compiled for your platform. If you see errors:

1. Ensure you downloaded the correct platform-specific VSIX
2. Reinstall the extension
3. Check VS Code version is 1.85.0 or higher

### Multiple Instances

Running both the Electron app and VS Code extension simultaneously is supported. The backend will auto-detect port conflicts and use the next available port (30002, 30003, etc.).

## Differences from Standalone App

| Feature | Standalone App | VS Code Extension |
|---------|---------------|-------------------|
| UI | Full custom UI | Native VS Code integration |
| Host List | Internal sidebar | TreeView in Activity Bar |
| Tab Management | Custom tabs | VS Code editor tabs |
| Data Storage | App userData | VS Code globalStorage |
| Multi-Instance | Single instance | Multiple VS Code windows supported |

## Development

To run the extension in development mode:

```bash
# Clone the repository
git clone https://github.com/snenjih/terminus.git
cd terminus

# Build the extension
npm install
npm run build:vscode

# Open in Extension Development Host
cd vscode-extension
code --extensionDevelopmentPath=$(pwd)
```

## Contributing

Contributions are welcome! Please see the main [repository](https://github.com/snenjih/terminus) for contribution guidelines.

## License

MIT License - see [LICENSE](https://github.com/snenjih/terminus/blob/main/LICENSE) for details.

## Support

- **GitHub Issues**: [https://github.com/snenjih/terminus/issues](https://github.com/snenjih/terminus/issues)
- **Documentation**: [https://github.com/snenjih/terminus](https://github.com/snenjih/terminus)

---

**Note**: This extension spawns a Node.js backend process that runs on ports 30001-30006. The process is automatically managed and cleaned up when VS Code closes.
