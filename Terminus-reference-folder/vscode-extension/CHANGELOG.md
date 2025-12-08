# Change Log

All notable changes to the Terminus VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial VS Code extension implementation
- Native TreeView for SSH host management in Activity Bar
- Single-session mode webview panels for terminal/files/tunnels
- Secure storage via VS Code SecretStorage API
- Platform-specific VSIX packages (Windows, Linux, macOS x64/ARM64)
- Command Palette integration for quick actions
- Context menu actions for host management
- Backend lifecycle management with health monitoring
- Auto-restart on backend crash (max 3 attempts)
- Multi-instance support (works alongside Electron app)

### Features
- **Host Management**: Add, edit, delete, duplicate, and export hosts
- **Terminal Sessions**: Full PTY support via node-pty
- **File Manager**: Browse and manage remote files
- **SSH Tunnels**: Local and remote port forwarding
- **Quick Connect**: Fast host selection via Command Palette
- **Folder Organization**: Group hosts by folders/tags
- **Context Menus**: Right-click actions in TreeView

### Technical
- Backend spawned as child process (ports 30001-30006)
- Graceful shutdown with SIGTERM/SIGKILL timeout
- Zombie process prevention (detached: false)
- Health check every 30 seconds
- Platform-specific native module compilation
- Webpack bundling for extension code

## [1.0.0] - TBD

Initial release of Terminus VS Code extension.
