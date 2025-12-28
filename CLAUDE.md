# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Labonair Connectivity is a VS Code extension that provides SSH/SFTP management with a Terminus-inspired interface. The extension uses a dual-architecture pattern:
- **Extension Host** (Node.js): Backend services, SSH connections, file operations
- **Webview** (React): UI rendered in VS Code webviews

## Development Commands

### Build & Development
```bash
npm install              # Install dependencies
npm run compile          # Build extension and webview (production)
npm run watch            # Auto-compile on file changes (development)
npm run package          # Production build with optimized source maps
```

### Testing & Quality
```bash
npm run lint             # Run ESLint on TypeScript files
npm run pretest          # Compile tests, extension, and run linting
npm test                 # Run test suite
npm run compile-tests    # Compile tests to out/ directory
npm run watch-tests      # Watch and compile tests
```

### Running the Extension
Press `F5` in VS Code to launch the Extension Development Host with the extension loaded.

## Architecture

### Dual Bundle System
The project uses Webpack to create two separate bundles:
1. **Extension Bundle** (`dist/extension.js`): Node.js code for VS Code extension host
   - Entry: `src/extension/main.ts`
   - Target: `node`
   - Contains all backend services and SSH connection logic

2. **Webview Bundle** (`dist/webview.js`): React UI code
   - Entry: `src/webview/index.tsx`
   - Target: `web`
   - Contains all React components and UI logic

### Communication Pattern
Extension and webview communicate via `postMessage` API:
- **Extension → Webview**: `webview.postMessage({ command: 'UPDATE_DATA', payload: {...} })`
- **Webview → Extension**: `vscode.postMessage({ command: 'ADD_HOST', payload: {...} })`

Message types are defined in `src/common/types.ts` as the `Message` interface.

### Connection Pool Architecture
The extension implements a singleton connection pool (`src/extension/services/connectionPool.ts`) that:
- Shares SSH connections between Terminal and SFTP services
- Uses reference counting to manage connection lifecycle
- Prevents duplicate connections to the same host
- Automatically releases connections when ref count reaches zero

Services acquire connections via `ConnectionPool.acquire()` and release via `ConnectionPool.release(hostId)`.

### Service Layer
Core services in `src/extension/` are instantiated in `main.ts` and injected into components:

**Core Services:**
- `HostService`: Manages host configurations (CRUD operations, storage)
- `CredentialService`: Handles secure credential storage via VS Code SecretStorage
- `SshConnectionService`: Manages SSH connections for terminals
- `SftpService`: Handles SFTP connections and file operations
- `TransferService`: Manages file transfer queue with progress tracking
- `BroadcastService`: Coordinates real-time updates between panels
- `HostKeyService`: Manages SSH host key verification and storage

**Utility Services:**
- `ScriptService`: Manages user-defined scripts
- `SessionTracker`: Tracks active SSH sessions
- `EditHandler`: Implements "edit-on-fly" functionality for remote files
- `ShellService`: Manages local shell detection and PTY services

### Panel System
The extension uses two types of UI containers:

1. **WebviewViewProvider** (Sidebar panels):
   - `ConnectivityViewProvider`: Host Manager sidebar view
   - `TransferQueueViewProvider`: Transfer Queue sidebar view
   - Registered in `package.json` under `contributes.views`

2. **WebviewPanel** (Editor panels):
   - `SftpPanel`: SFTP file browser in editor area
   - `TerminalPanel`: SSH terminal in editor area
   - `MediaPanel`: Base class for media panels with lifecycle management

### React Application Structure
The webview React app (`src/webview/App.tsx`) uses context detection:
- `window.LABONAIR_CONTEXT`: Determines rendering mode (`'sidebar'`, `'editor'`, or `'queue'`)
- Renders different views based on context (Host Manager, File Manager, Terminal, Transfer Queue)

**View Components** (`src/webview/views/`):
- `EditHost.tsx`: Host configuration form
- `CredentialsView.tsx`: Credential management
- `FileManager.tsx`: SFTP file browser
- `TerminalView.tsx`: SSH terminal interface
- `TransferQueue.tsx`: File transfer queue display

### Type Definitions
All shared types are in `src/common/types.ts`:
- `Host`: SSH host configuration with authentication, terminal settings, file manager preferences
- `Credential`: Stored credentials (password or SSH key)
- `FileEntry`: SFTP file/directory metadata
- `TransferJob`: File transfer job with progress tracking
- `Message`: Webview-Extension communication protocol

## Important Patterns

### Authentication Flow
1. User selects auth type: `password`, `key`, `agent`, or `credential`
2. If `credential` type, references a `Credential` by `credentialId`
3. `CredentialService` retrieves password/key from VS Code SecretStorage
4. `ConnectionPool` uses credentials to establish SSH connection
5. Host key verification occurs via `HostKeyService` before connection

### File Transfer System
1. User initiates transfer via File Manager UI
2. `TransferService` creates `TransferJob` with unique ID
3. Job is queued and processed based on concurrency limits
4. Progress callbacks update Transfer Queue webview in real-time
5. `BroadcastService` notifies all relevant panels of state changes

### Edit-on-Fly Pattern
1. User clicks "Edit" on remote file in SFTP panel
2. `EditHandler.openRemoteFile(hostId, remotePath)` downloads file to temp directory
3. VS Code opens temp file in editor
4. `FileSystemWatcher` monitors for changes
5. On save, `EditHandler` uploads file back to remote host
6. Supports sudo mode for files requiring elevated permissions

### Host Key Management
SSH host keys are verified and stored:
1. On first connection, host key fingerprint is shown to user
2. User accepts/rejects via `HostKeyDialog`
3. Accepted keys stored in workspace state by `HostKeyService`
4. Subsequent connections verify against stored fingerprint
5. Changed keys trigger security warning

## Key Files to Understand

- `src/extension/main.ts`: Extension entry point, service initialization, command registration
- `src/extension/services/connectionPool.ts`: Connection pooling and lifecycle
- `src/webview/App.tsx`: React app routing and state management
- `src/common/types.ts`: Shared type definitions (source of truth)
- `webpack.config.js`: Dual bundle configuration
- `package.json`: Extension manifest, commands, views, activation events

## VS Code Integration

### Activation Events
The extension activates when:
- Host Manager view is opened (`onView:labonair.views.hosts`)
- Transfer Queue view is opened (`onView:labonair.views.queue`)

### Contributed Views
- Activity Bar container: `labonair` (icon: `server-process`)
  - `labonair.views.hosts`: Host Manager webview
  - `labonair.views.queue`: Transfer Queue webview

### Contributed Commands
- `labonair.quickConnect`: Quick connect via `user@host:port` syntax
- `labonair.openSFTP`: Open SFTP file manager for selected host
- `labonair.editRemoteFile`: Internal command for edit-on-fly

## Dependencies

### Runtime Dependencies
- `ssh2`: SSH2 client for Node.js (SSH connections, SFTP)
- `@xterm/xterm`: Terminal emulator for SSH terminal UI
- `react` / `react-dom`: UI framework for webviews
- `lucide-react`: Icon library
- `uuid`: Unique ID generation

### Security Considerations
- Never commit credentials to source control
- Use VS Code's SecretStorage API for credential persistence
- Validate host keys before establishing connections
- Sanitize file paths to prevent path traversal attacks
- Use sudo mode carefully and validate user permissions
