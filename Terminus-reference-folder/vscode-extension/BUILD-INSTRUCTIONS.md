# VS Code Extension Build Instructions

This document provides detailed instructions for building, packaging, and installing the Terminus VS Code extension locally.

## Prerequisites

1. **Node.js 22+** installed on your system
2. **VS Code** installed and accessible via `code` command in PATH
3. **npm** or **yarn** package manager
4. **Git** for version control

## Directory Structure

```
vscode-extension/
├── dist/                   # Compiled extension code (generated)
│   ├── extension.js       # Main extension bundle
│   ├── backend/           # Compiled backend code (copied from root)
│   └── frontend/          # Built React frontend (copied from root)
├── src/                   # Extension source code
│   ├── extension.ts       # Entry point
│   ├── backend-manager.ts # Backend process manager
│   ├── storage-manager.ts # VS Code storage wrapper
│   ├── views/             # TreeView and Webview providers
│   ├── commands/          # Command implementations
│   └── utils/             # Utility functions
├── package.json           # Extension manifest
├── tsconfig.json          # TypeScript configuration
├── webpack.config.js      # Webpack bundler config
└── icon.png              # Extension icon (128x128)
```

## Build Process Overview

The build process consists of three main steps:

1. **Build Backend** - Compile TypeScript backend code
2. **Build Frontend** - Build React frontend for VS Code webview
3. **Build Extension** - Compile extension TypeScript + rebuild native modules

## Step-by-Step Build Instructions

### Step 1: Install Root Dependencies

From the project root directory:

```bash
cd /path/to/terminus
npm install
```

This installs all dependencies for the main Terminus application, including shared dependencies.

### Step 2: Build Backend

Compile the backend TypeScript code:

```bash
npm run build:backend
```

This runs: `tsc -p tsconfig.node.json`

Output: `dist/backend/` directory with compiled Node.js code

### Step 3: Build Frontend for VS Code

Build the React frontend with Vite, outputting to the extension directory:

```bash
npm run build:vscode:frontend
```

This runs: `vite build --outDir vscode-extension/dist/frontend`

Output: `vscode-extension/dist/frontend/` with bundled React app

### Step 4: Install Extension Dependencies

Navigate to the extension directory and install dependencies:

```bash
cd vscode-extension
npm install
```

This installs:
- `@electron/rebuild` - For native module compilation
- `@vscode/vsce` - For packaging VSIX files
- `webpack` + `webpack-cli` - For bundling extension code
- `ts-loader` - TypeScript loader for webpack
- TypeScript and ESLint dev dependencies

### Step 5: Copy Backend to Extension Dist

The backend needs to be accessible to the extension:

```bash
# From vscode-extension directory
mkdir -p dist/backend
cp -r ../dist/backend/* dist/backend/
```

Or use the convenience script from root:

```bash
# From root directory
npm run build:vscode
```

This runs all three build steps automatically.

### Step 6: Build Extension

Compile the extension TypeScript code and rebuild native modules:

```bash
# From vscode-extension directory
npm run compile
```

This runs:
1. `npm run rebuild-native` - Rebuilds node-pty and better-sqlite3 for VS Code's Electron version
2. `webpack --mode production` - Bundles extension code

Output: `vscode-extension/dist/extension.js`

### Step 7: Package Extension

Create a platform-specific VSIX file:

#### Single Platform (Current System)

```bash
# From vscode-extension directory
npm run package:single
```

This creates: `terminus-vscode-1.0.0.vsix` (universal VSIX)

#### Platform-Specific VSIX Files

To create platform-specific VSIX files for all platforms:

```bash
# From vscode-extension directory
npm run package
```

This runs: `vsce package --target win32-x64 linux-x64 darwin-x64 darwin-arm64`

Output files:
- `terminus-vscode-1.0.0-win32-x64.vsix`
- `terminus-vscode-1.0.0-linux-x64.vsix`
- `terminus-vscode-1.0.0-darwin-x64.vsix`
- `terminus-vscode-1.0.0-darwin-arm64.vsix`

## Native Module Compilation

The extension uses two native modules that must be compiled for VS Code's Electron version:

1. **node-pty** - PTY (pseudo-terminal) for terminal sessions
2. **better-sqlite3** - SQLite database driver

### Automatic Compilation

The `rebuild-native` script automatically detects VS Code's Electron version and rebuilds:

```bash
npm run rebuild-native
```

This runs: `electron-rebuild -f -w node-pty,better-sqlite3 -v ${VSCODE_ELECTRON_VERSION:-29.0.0}`

### Manual Compilation

If automatic detection fails, you can specify the Electron version manually:

```bash
# Find VS Code's Electron version
code --version
# Output: 1.85.0
#         <commit-hash>
#         x64

# Get Electron version from VS Code release notes or process.versions
# Example: Electron 29.0.0

# Rebuild with specific version
VSCODE_ELECTRON_VERSION=29.0.0 npm run rebuild-native
```

### Troubleshooting Native Modules

If native modules fail to load:

1. **Check VS Code Electron version**:
   ```bash
   code --version
   ```

2. **Verify module compilation**:
   ```bash
   ls -la ../node_modules/node-pty/build/Release/
   ls -la ../node_modules/better-sqlite3/build/Release/
   ```

3. **Check for errors in VS Code Output panel**:
   - Open VS Code
   - View → Output
   - Select "Terminus" from dropdown
   - Look for "Error loading native module" messages

4. **Rebuild with verbose output**:
   ```bash
   DEBUG=electron-rebuild npm run rebuild-native
   ```

## Installation

### Install from VSIX File

Once you have a VSIX file, install it in VS Code:

```bash
code --install-extension terminus-vscode-1.0.0.vsix
```

Or manually:
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Click the `...` menu (top-right of Extensions panel)
4. Select "Install from VSIX..."
5. Choose the VSIX file

### Verify Installation

1. Restart VS Code after installation
2. Look for the Terminus icon in the Activity Bar (left sidebar)
3. Click the icon to open the Terminus sidebar
4. Check the Output panel (View → Output → Terminus) for backend startup logs

## Development Mode

To develop the extension with live reloading:

### Method 1: Using npm script (recommended)

```bash
# From root directory
npm run dev:vscode
```

This:
1. Builds the backend
2. Starts webpack in watch mode
3. Opens VS Code with the extension loaded

### Method 2: Manual steps

1. **Terminal 1** - Watch mode for extension code:
   ```bash
   cd vscode-extension
   npm run watch
   ```

2. **Terminal 2** - Open Extension Development Host:
   ```bash
   code --extensionDevelopmentPath=/path/to/terminus/vscode-extension
   ```

3. **Terminal 3** - Watch mode for frontend (optional):
   ```bash
   npm run dev
   ```

### Debugging in Extension Development Host

1. Open the extension source in VS Code
2. Press `F5` to launch Extension Development Host
3. A new VS Code window opens with the extension loaded
4. Set breakpoints in `src/extension.ts` or other TypeScript files
5. Debug Console shows extension logs

### Testing Changes

After making changes:

1. **Extension code** (`src/*.ts`):
   - Saved automatically by watch mode
   - Reload Extension Development Host: Ctrl+R / Cmd+R

2. **Frontend code** (`src/ui/*`):
   - Rebuild: `npm run build:vscode:frontend`
   - Reload Extension Development Host

3. **Backend code** (`src/backend/*`):
   - Rebuild: `npm run build:backend`
   - Copy to extension: `cp -r dist/backend/* vscode-extension/dist/backend/`
   - Reload Extension Development Host

## Testing the Extension

### Basic Functionality Tests

1. **Backend Startup**:
   - Open VS Code Output panel (View → Output)
   - Select "Terminus" from dropdown
   - Should see "Backend started on port 30001" within 5 seconds

2. **TreeView**:
   - Click Terminus icon in Activity Bar
   - Sidebar should show "SSH Hosts"
   - Click "+" icon to add a host

3. **Host Operations**:
   - Add a test host (local or remote)
   - Right-click host → Edit Host
   - Right-click host → Delete Host
   - Click host to open webview panel

4. **Terminal Connection**:
   - Open a host
   - Terminal should load in webview panel
   - Type commands and verify they execute

5. **File Manager**:
   - Switch to Files view in webview
   - Browse remote directories
   - Upload/download files

### Platform-Specific Tests

Test on each target platform:

- **Windows x64**: Test on Windows 10/11
- **Linux x64**: Test on Ubuntu 20.04+ or similar
- **macOS Intel**: Test on macOS 10.13+
- **macOS Apple Silicon**: Test on macOS 11+ with M1/M2/M3 chip

### Performance Tests

1. **Backend Startup Time**: Should be < 5 seconds
2. **Memory Usage**: Monitor with Activity Monitor / Task Manager
3. **Multiple Hosts**: Test with 10+ hosts in TreeView
4. **Long-Running Session**: Keep extension open for 1+ hours

### Error Handling Tests

1. **Port Conflict**: Start Electron app, then open VS Code extension (should use port 30002)
2. **Backend Crash**: Kill backend process, verify auto-restart
3. **Invalid Host**: Try connecting to non-existent host
4. **Network Issues**: Test with poor network connection

## CI/CD Integration

The extension is automatically built by GitHub Actions on push to main.

### Workflow Files

1. **deploy.yml** - Builds extension as part of main deployment
2. **vscode-extension.yml** - Standalone extension build workflow

### Triggering Builds

```bash
# Push to main branch
git push origin main

# Or manually trigger standalone workflow
gh workflow run vscode-extension.yml
```

### Download Artifacts

After CI/CD build completes:

1. Go to GitHub Actions tab
2. Click on the workflow run
3. Scroll to "Artifacts" section
4. Download platform-specific VSIX files

## Troubleshooting

### Issue: "Cannot find module 'better-sqlite3'"

**Solution**: Rebuild native modules for VS Code's Electron version
```bash
cd vscode-extension
npm run rebuild-native
```

### Issue: "Backend failed to start"

**Causes**:
1. Port 30001 already in use
2. Missing backend files in `dist/backend/`
3. Permissions issue with globalStorage directory

**Solutions**:
1. Check if Electron app is running (uses same port)
2. Rebuild backend: `npm run build:backend`
3. Check VS Code Output panel for detailed errors

### Issue: "Extension activation failed"

**Solution**: Check VS Code Developer Tools
1. Help → Toggle Developer Tools
2. Console tab shows JavaScript errors
3. Look for module loading errors

### Issue: "VSIX packaging fails"

**Error**: `vsce` command not found

**Solution**: Install vsce globally or use npx
```bash
npm install -g @vscode/vsce
# or
npx vsce package
```

### Issue: "Webpack compilation errors"

**Solution**: Clear webpack cache and rebuild
```bash
cd vscode-extension
rm -rf dist/
npm run compile
```

## Advanced Topics

### Custom Backend Port

To use a different backend port:

1. Edit `vscode-extension/package.json`:
   ```json
   {
     "contributes": {
       "configuration": {
         "properties": {
           "terminus.backendPort": {
             "default": 30001  // Change this
           }
         }
       }
     }
   }
   ```

2. Rebuild extension:
   ```bash
   npm run compile
   ```

### Publishing to VS Code Marketplace

Prerequisites:
1. Create publisher account at https://marketplace.visualstudio.com/manage
2. Generate Personal Access Token (PAT) with Marketplace scope
3. Add `VSCE_PAT` secret to GitHub repository

Manual publish:
```bash
cd vscode-extension
npx vsce publish -p <YOUR_PAT>
```

Automated publish (via CI/CD):
- Workflow automatically publishes on version change
- Requires `VSCE_PAT` secret in GitHub

### Signing Extension

For enterprise distribution:
1. Obtain code signing certificate
2. Sign VSIX with `signtool` (Windows) or `codesign` (macOS)
3. Distribute signed VSIX

## Summary

The complete build process from scratch:

```bash
# From project root
cd /path/to/terminus

# Install dependencies
npm install

# Build everything
npm run build:vscode

# Package extension
cd vscode-extension
npm run package:single

# Install
code --install-extension terminus-vscode-1.0.0.vsix
```

For development:
```bash
npm run dev:vscode
```

For CI/CD:
```bash
git push origin main
```

## Resources

- VS Code Extension API: https://code.visualstudio.com/api
- VS Code Publishing: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- electron-rebuild: https://github.com/electron/rebuild
- vsce CLI: https://github.com/microsoft/vscode-vsce
