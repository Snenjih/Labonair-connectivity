# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Terminus is a self-hosted server management platform with SSH terminal access, tunneling, file management, and server monitoring capabilities. Built as a full-stack TypeScript application using React, Vite, Express, and SQLite with Drizzle ORM.

## Development Commands

### Frontend Development
```bash
npm run dev                    # Start Vite dev server (http://localhost:5173)
npm run build                  # Build frontend and compile backend TypeScript
npm run preview                # Preview production build
```

### Backend Development
```bash
npm run dev:backend            # Compile backend TypeScript and run Express server
npm run build:backend          # Compile backend TypeScript only
```

### Electron Desktop App
```bash
npm run electron:dev           # Run Electron app in development mode
npm run build:win-portable     # Build Windows portable version
npm run build:win-installer    # Build Windows installer
npm run build:linux-portable   # Build Linux portable version
npm run build:linux-appimage   # Build Linux AppImage
npm run build:linux-targz      # Build Linux tar.gz
```

### Code Quality
```bash
npm run clean                  # Format code with Prettier
```

## Architecture

### Frontend Architecture

**Entry Point**: [src/main.tsx](src/main.tsx)
- Renders either `DesktopApp` (viewport ≥768px) or `MobileApp` (<768px)
- Forces `DesktopApp` when running in Electron
- Uses `ThemeProvider` for dark/light mode management

**Layout Structure**:
- Desktop: `src/ui/Desktop/` - Full desktop interface with sidebar navigation
- Mobile: `src/ui/Mobile/` - Responsive mobile interface with bottom navigation
- Shared Components: `src/components/ui/` - shadcn/ui components with Tailwind CSS

**State Management**: React hooks and context, no external state library

**Internationalization**: i18next with language files in `src/locales/` (en, zh, de)

### Backend Architecture

**Entry Point**: [src/backend/starter.ts](src/backend/starter.ts)
- Initializes encryption system (JWT, database key, internal auth token)
- Sets up SSL certificates if configured
- Initializes database and authentication
- Imports Express API routes and WebSocket handlers

**API Server**: [src/backend/database/database.ts](src/backend/database/database.ts)
- Express server on port 30001 (HTTP) and 8443 (HTTPS with SSL)
- RESTful API with JWT authentication middleware
- CORS configured for local development and production

**Database Layer**:
- SQLite with Drizzle ORM
- Schema: [src/backend/database/db/schema.ts](src/backend/database/db/schema.ts)
- Tables: users, settings, ssh_data, ssh_credentials, file_manager_recent/pinned/shortcuts, dismissed_alerts, color_themes, session_state
- At-rest encryption using KEK (Key Encryption Key) + DEK (Data Encryption Key) model
- User data encrypted with password-derived keys

**SSH Functionality**:
- Terminal: [src/backend/ssh/terminal.ts](src/backend/ssh/terminal.ts) - WebSocket-based terminal sessions using xterm.js
- Tunnels: [src/backend/ssh/tunnel.ts](src/backend/ssh/tunnel.ts) - SSH tunnel management with health monitoring
- File Manager: [src/backend/ssh/file-manager.ts](src/backend/ssh/file-manager.ts) - Remote file operations via SSH
- Server Stats: [src/backend/ssh/server-stats.ts](src/backend/ssh/server-stats.ts) - CPU, memory, disk monitoring

**Security Utilities**:
- `SystemCrypto`: System-level encryption keys (JWT secret, database key)
- `DataCrypto`: User data encryption/decryption with per-user keys
- `AuthManager`: JWT token management and user authentication
- `DatabaseFileEncryption`: SQLite database file encryption at rest

### API Structure

**Routes**:
- `/users` - User management, authentication, OIDC, TOTP
- `/ssh` - SSH host management, connection operations
- `/credentials` - SSH credential storage and management
- `/settings` - User settings storage and retrieval
- `/themes` - Color theme management (CRUD operations, activation)
- `/session` - Session state management (save/restore open tabs)
- `/alerts` - Dismissed alert tracking
- `/version` - Version checking against GitHub releases
- `/database/export` - Export user data as encrypted SQLite
- `/database/import` - Import user data with incremental sync

**Middleware**:
- `authenticateJWT` - Validates JWT tokens for protected routes
- `requireAdmin` - Restricts routes to admin users only

## Key Technical Patterns

### Encryption Model
- System-level keys stored in `db/data/.system-secrets/`
- User data keys derived from user passwords using bcrypt
- Sensitive fields (passwords, SSH keys) encrypted at field level
- Database file encrypted at rest

### Responsive Design
- Single codebase with conditional rendering based on viewport width
- Desktop/Mobile components separated but share API layer
- Breakpoint: 768px (switch between MobileApp and DesktopApp)

### WebSocket Communication
- Terminal sessions use WebSocket for real-time PTY interaction
- SSH tunnel status updates via WebSocket
- File manager operations use HTTP with chunked uploads

### Path Aliases
TypeScript paths configured with `@/*` mapping to `./src/*`

## Frontend Development Notes

### API Client
All API routes are centralized in [src/ui/main-axios.ts](src/ui/main-axios.ts). When adding new endpoints, update this file rather than creating inline axios calls.

### Styling
- Uses Tailwind CSS 4.x with custom color variables
- Color scheme defined in CONTRIBUTING.md - always use CSS variables (e.g., `bg-[var(--color-dark-bg)]`)
- shadcn/ui components in `src/components/ui/`
- Mobile-specific styles should only apply at <768px breakpoint

### UI Components
- Radix UI primitives with shadcn/ui styling
- Custom components extend shadcn base components
- Form validation using react-hook-form + zod

### Settings Page Architecture
**Implemented**: 2025-10-18 (Phase 2.1 & 2.2)

The settings page follows a two-column layout pattern:
- **Location**: `src/ui/Desktop/Settings/`
- **Main Component**: `SettingsPage.tsx` - Container with sidebar and content area
- **Sidebar**: `SettingsSidebar.tsx` - Navigation with 6 categories
- **Tab Type**: `settings` - Closeable tab type that can be opened via Cog icon in TopNavbar

**Categories** (defined in SettingsSidebar):
1. **Application** (Implemented Phase 2.2) - App version, links, update check settings
2. Appearance - UI customization options
3. **Color Scheme** (Implemented Phase 2.4) - Theme and color customization
4. **Terminal** (Implemented Phase 2.3) - Terminal-specific settings
5. **File Manager** (Implemented Phase 2.3) - File manager layout and behavior
6. Hotkeys - Keyboard shortcut configuration

**Integration Points**:
- `TabContextTab` type includes `"settings"` tab type (src/types/index.ts:263)
- TopNavbar includes Cog icon button to open settings tab (TopNavbar.tsx:468-476)
- DesktopApp renders SettingsPage when current tab is settings (DesktopApp.tsx:194-198)
- Settings tab is closeable and respects split-screen mode restrictions

**Application Settings Implementation** (Phase 2.2):
- **Component**: `ApplicationSettings.tsx` - Default view when settings page opens
- **Header Section**:
  - Displays Terminus logo from `/icon.svg`
  - Shows application name and version (read from package.json)
  - Three external link buttons: GitHub, Discord, Docs (using lucide-react icons)
- **Settings**:
  - "Automatic Update Check" toggle using shadcn/ui Switch component
  - State persisted to database via `/settings` API endpoint
  - Loads setting on component mount with error handling and default fallback
  - Updates setting on toggle with optimistic UI and error reversion
- **Backend**:
  - Route handler: `src/backend/database/routes/settings.ts`
  - Four endpoints: GET `/settings/:key`, GET `/settings`, POST `/settings`, DELETE `/settings/:key`
  - Uses `settings` table (key-value pairs) from database schema
  - Protected with JWT authentication middleware
- **API Integration**:
  - Functions in `src/ui/main-axios.ts`: `getSetting()`, `getAllSettings()`, `saveSetting()`, `deleteSetting()`

**Terminal & File Manager Settings Implementation** (Phase 2.3):
- **File Manager Component**: `FileManagerSettings.tsx`
  - Provides "File Manager Design" dropdown using shadcn/ui Select component
  - Two options: "Explorer" (single-panel) and "Commander" (dual-panel Orthodox layout)
  - Explorer is the current implementation, Commander will be implemented in Phase 3.4
  - Setting key: `file_manager_design` (values: "explorer" or "commander")
  - Helpful descriptions explain current vs. future functionality
- **Terminal Component**: `TerminalSettings.tsx`
  - Provides "Font Size" input using shadcn/ui Input component
  - Number-only input with validation (8-32px range)
  - Value validated and constrained on blur event
  - Setting key: `terminal_font_size` (default: "14")
  - Will be used to configure xterm.js instances in future updates
- **Integration**:
  - Both components follow the same pattern as ApplicationSettings
  - Use `getSetting()` and `saveSetting()` from main-axios.ts
  - Load settings on mount with error handling and defaults
  - Optimistic UI updates with error reversion
  - Integrated into SettingsPage.tsx switch statement

**Color Scheme Customization Implementation** (Phase 2.4):
- **Component**: `ColorSchemeSettings.tsx` - Full theme customization interface
- **Dependencies**:
  - react-color (v2.19.3) - SketchPicker for color selection
  - @types/react-color - TypeScript definitions
- **Color Variables**:
  - 35+ customizable CSS variables organized into 5 categories:
    - Base: Background, foreground, card, popover colors
    - Interactive: Primary, secondary, muted, accent colors
    - Status: Destructive, border, input, ring colors
    - Custom: Dark theme background variants
    - Custom Borders: Dark theme border and state colors
- **Features**:
  - Live preview - color changes apply instantly to root element CSS variables
  - Theme management - save, load, delete custom themes
  - Color picker modal with preset colors and RGB/HSL/Hex input
  - Category-based color organization for better UX
  - Reset to default functionality
- **Backend**:
  - Database table: `color_themes` with userId, name, colors (JSON), isActive, timestamps
  - Route handler: `src/backend/database/routes/themes.ts`
  - Endpoints: GET `/themes`, GET `/themes/:id`, POST `/themes`, PUT `/themes/:id`, DELETE `/themes/:id`, PUT `/themes/:id/activate`
  - Protected with JWT authentication middleware
- **API Integration**:
  - ColorTheme interface in main-axios.ts
  - Functions: `getThemes()`, `getTheme()`, `createTheme()`, `updateTheme()`, `deleteTheme()`, `activateTheme()`
- **Components**:
  - `ColorPickerModal.tsx` - Modal overlay with SketchPicker for color selection
  - Uses simple div-based modal pattern (no dialog component)
  - Displays current color swatch and hex value
  - Cancel/Apply buttons with state management
- **Integration**:
  - Integrated into SettingsPage.tsx switch statement
  - Themes persist per user in database
  - Active theme loaded on application startup (future enhancement)

**Future Phases**:
- Phase 2.5: Appearance Settings
- Phase 2.6: Hotkeys Configuration

### Host Manager Bulk Actions
**Implemented**: 2025-10-18 (Phase 3.2)

The Host Manager supports bulk operations on multiple hosts for efficient server management:

**Backend Endpoints** (`src/backend/database/routes/ssh.ts`):
- `POST /ssh/bulk-delete` - Delete up to 100 hosts at once
  - Cascades deletions to file_manager tables and credential usage
  - Returns success/failure counts with error details
- `POST /ssh/bulk-assign-tags` - Assign tags to multiple hosts
  - Modes: "add" (append to existing tags) or "replace" (overwrite all tags)
  - Handles duplicate tag detection
- `POST /ssh/bulk-move-to-folder` - Move hosts to a folder
  - Accepts empty string for "Uncategorized"
  - Creates new folders automatically
- `POST /ssh/bulk-export` - Export hosts with decrypted credentials
  - Requires data access permission via `requireDataAccess` middleware
  - Returns JSON array of host configurations

**Frontend Implementation** (`src/ui/Desktop/Apps/Host Manager/HostManagerViewer.tsx`):
- Multi-select state management using `Set<number>` for selected host IDs
- Checkbox on each host card for individual selection (line 1142-1147)
- "Select All" checkbox in folder headers (line 1036-1041)
- Actions dropdown button appears when hosts are selected (line 766-799)
  - Shows selected count in button text
  - Provides 4 bulk operations with icons and descriptions

**Modal Components**:
- `AssignTagsModal.tsx` - Tag assignment interface
  - Tag input with Enter key support
  - Visual tag management with remove capability
  - Radio buttons for "add" or "replace" mode
  - Uses div-based modal pattern matching QuickConnectModal
- `MoveToFolderModal.tsx` - Folder selection interface
  - Toggle between existing folder dropdown and new folder input
  - Dropdown populated with unique existing folders plus "Uncategorized"
  - Keyboard support (Enter to confirm, Escape to cancel)

**API Integration** (`src/ui/main-axios.ts`):
- `bulkDeleteSSHHosts(hostIds: number[])`
- `bulkAssignTags(hostIds: number[], tags: string[], mode: "add" | "replace")`
- `bulkMoveToFolder(hostIds: number[], folder: string)`
- `bulkExportSSHHosts(hostIds: number[])`

**UX Features**:
- All operations provide detailed success/failure feedback via toast notifications
- Destructive operations (delete) show confirmation dialogs via `useConfirmation` hook
- Export downloads JSON file with timestamp in filename
- Operations automatically refresh host list and trigger "ssh-hosts:changed" event
- Selection state cleared after successful operations

### Session Restoration
**Implemented**: 2025-10-18 (Phase 3.3)

Terminus automatically saves and restores the user's workspace (open tabs) across application restarts, providing a seamless continuation of work.

**Architecture**:
- **Database**: `session_state` table stores serialized tab data per user
- **Backend Routes**: `src/backend/database/routes/session.ts`
  - GET `/session` - Retrieve saved session for current user
  - POST `/session` - Save session data
  - DELETE `/session` - Clear saved session
- **API Integration**: `src/ui/main-axios.ts`
  - `getSessionState()` - Fetch session data
  - `saveSessionState(sessionData)` - Save tabs array
  - `deleteSessionState()` - Remove saved session
- **Frontend Logic**: `src/ui/Desktop/Navigation/Tabs/TabContext.tsx`

**Implementation Details**:
1. **Session Restoration (on mount)**:
   - Loads saved session from database when TabProvider initializes
   - Filters out `ssh_manager` tab (always present by default)
   - Recreates `terminalRef` for terminal and local_terminal tab types
   - Sets first restored tab as current
   - Clears saved state after successful restoration

2. **Automatic Saving (on tab changes)**:
   - Debounced save (500ms) triggers when tabs array changes
   - Only saves after initial session restoration completes
   - Excludes `ssh_manager` tab and non-serializable `terminalRef`
   - Deletes session if no tabs remain (besides ssh_manager)

3. **Save on Close (beforeunload)**:
   - Uses `navigator.sendBeacon` for reliable data transmission during page unload
   - Ensures session persists even if app closes unexpectedly
   - Synchronous operation for guaranteed execution

**Serialized Data**:
Only essential tab properties are saved:
- `id` - Tab identifier
- `type` - Tab type (terminal, file_manager, settings, etc.)
- `title` - Display title
- `hostConfig` - SSH host configuration (for SSH-related tabs)

**Important Notes**:
- Session restoration only works for authenticated users (JWT required)
- Terminal connections are NOT automatically reconnected (user must manually reconnect)
- File manager tabs restore with last known path (if stored in hostConfig)
- Settings and other non-SSH tabs restore with their last state

### File Manager Local/Remote Dual-Panel
**Implemented**: 2025-10-18 (Phase 3.5)

The Commander View now supports local and remote file systems in a dual-panel layout, enabling efficient file transfers between local and remote systems.

**Features**:
- **Left Panel**: Local files from user's home directory
- **Right Panel**: Remote SSH files
- **Panel Type Indicators**: Visual badges show panel type (📁 Local / 🌐 Remote)
- **Cross-Panel Transfers**: All 4 transfer scenarios supported:
  1. Local → Local: Direct local copy using `copyLocalItem()`
  2. Local → Remote: Upload to SSH server (local read + SSH upload)
  3. Remote → Local: Download from SSH server (SSH download + local write)
  4. Remote → Remote: SSH server-to-server copy using `copySSHItem()`
- **Full CRUD Operations**: Create, read, update, delete for both local and remote files
- **Panel-Aware Handlers**: Context menus and operations adapt based on panel type

**Architecture**:
- Local file operations use dedicated backend (`src/backend/local/local-file-manager.ts` on port 30006)
- Panel type state (`leftPanelType`, `rightPanelType`) controls behavior and rendering
- Conditional handler routing based on active panel type
- Security: Local operations restricted to user's home directory via `getSafeLocalPath()`

**Implementation Details**:
- **FileManager.tsx** (`src/ui/Desktop/Apps/File Manager/FileManager.tsx`):
  - Panel type state management (lines 122-123)
  - Local file state (leftLocalPath, leftLocalFiles, leftLocalLoading - lines 126-128)
  - `loadLocalDirectory()` function (lines 401-427)
  - Local operation handlers (lines 1295-1423):
    - `handleLocalConfirmCreate()` - Create local files/folders
    - `handleDeleteLocalFiles()` - Delete with confirmation
    - `handleRenameLocalFile()` - Rename local items
    - `handleLocalFileDrop()` - Drag & drop within local panel
    - `handleLocalFileOpen()` - Directory navigation
  - Conditional props passed to CommanderView (lines 2028-2084)
- **CommanderView.tsx** (`src/ui/Desktop/Apps/File Manager/CommanderView.tsx`):
  - Extended props interface with panel types (lines 17-19)
  - Visual indicators with panel type badges (lines 244-254, 298-308)
  - Cross-panel transfer logic handling all 4 scenarios (lines 117-241)
- **Backend API** (`src/backend/local/local-file-manager.ts`):
  - Complete local file management on port 30006
  - All paths restricted to user home directory
  - Full CRUD operations with same interface as SSH file manager

**File References**:
- `src/backend/local/local-file-manager.ts` - Local file backend (563 lines)
- `src/ui/main-axios.ts` - Local file API functions (lines 1434-1609)
- `src/ui/Desktop/Apps/File Manager/FileManager.tsx` - Main implementation
- `src/ui/Desktop/Apps/File Manager/CommanderView.tsx` - Panel UI and transfer logic

### File Manager Commander View
**Implemented**: 2025-10-18 (Phase 3.4 - Part 1)

The File Manager now supports two layout modes: Explorer (single-panel) and Commander (dual-panel Orthodox layout).

**Architecture**:
- **Setting**: `file_manager_design` setting controls layout ("explorer" or "commander")
- **Components**:
  - `CommanderView.tsx` (283 lines) - Two-panel layout implementation
  - `FileManager.tsx` - Conditionally renders Explorer or Commander based on setting
  - `FileManagerSettings.tsx` - Dropdown to switch between layouts

**Commander View Features**:
- **Two Independent Panels**: Left and right panels each have their own:
  - File list state (leftFiles, rightFiles)
  - Current path state (leftPath, rightPath)
  - Loading state (leftLoading, rightLoading)
  - Create intent state for file/folder creation
- **Active/Passive Panel System**:
  - Click on panel to make it active (blue border indicator)
  - "Active Panel" badge shows in top-right corner of active panel
  - Helps users track which panel has focus
- **Cross-Panel Operations**:
  - Drag files from one panel to folder in other panel to copy
  - Uses `copySSHItem` API for data transfer
  - Auto-refreshes both panels after successful transfer
  - Toast notifications for operation feedback
- **Full Feature Parity**: Both panels support:
  - Directory navigation
  - File/folder creation, deletion, renaming
  - Context menus and keyboard shortcuts
  - All existing file manager features

**Implementation Details**:
- CommanderView receives props from FileManager for both panels
- Each panel renders FileManagerGrid with independent state
- Selection management using useFileSelection hook (separate instances)
- Cross-panel drag handlers capture source panel and target folder
- Setting loaded on component mount via `getSetting("file_manager_design")`

**File References**:
- `src/ui/Desktop/Apps/File Manager/CommanderView.tsx` - Main component
- `src/ui/Desktop/Apps/File Manager/FileManager.tsx:106-112` - Right panel state
- `src/ui/Desktop/Apps/File Manager/FileManager.tsx:1625-1636` - Setting loader
- `src/ui/Desktop/Apps/File Manager/FileManager.tsx:1638-1727` - Right panel logic
- `src/ui/Desktop/Apps/File Manager/FileManager.tsx:1838-1965` - Conditional rendering
- `src/ui/Desktop/Settings/FileManagerSettings.tsx` - Layout selector

**Future Enhancements** (Phase 3.4 - Parts 2 & 3):
- Part 2: Remote Editor integration for editing text files in tabs
- Part 3: Transfer Queue with progress tracking for uploads/downloads

## Backend Development Notes

### Database Operations
- Use Drizzle ORM queries via `getDb()` from `src/backend/database/db/index.ts`
- Encrypt sensitive data with `DataCrypto.encryptRecord()` before insert
- Decrypt sensitive data with `DataCrypto.decryptRecord()` after select
- User must be authenticated and data unlocked before encryption/decryption

### Adding New API Routes
1. Create route handler in `src/backend/database/routes/`
2. Import and mount in `src/backend/database/database.ts`
3. Add corresponding axios function in `src/ui/main-axios.ts`
4. Apply `authenticateJWT` and/or `requireAdmin` middleware as needed

### SSH Operations
All SSH operations use the `ssh2` library with connection pooling and retry logic. Connection credentials are decrypted just-in-time from the database.

## Build and Deployment

### Production Build
```bash
npm run build                  # Builds frontend to dist/ and backend to dist/backend/
```

### Docker Deployment
The application runs in Docker with:
- Express backend serving API on port 8080
- Frontend static files served by backend
- SQLite database persisted in `/app/data` volume
- Optional SSL with auto-generated certificates

### Electron Desktop App
- Main process: `electron/main.cjs`
- Preload script: `electron/preload.js`
- Bundles backend Node.js server with Electron app
- Uses `electron-builder` for packaging

## Testing

### Encryption Testing
```bash
npm run test:encryption        # Test encryption/decryption functionality
npm run migrate:encryption     # Migrate data to new encryption scheme
```

## Important Files

- `openapi.json` - API documentation (manually maintained)
- `electron-builder.json` - Electron build configuration
- `components.json` - shadcn/ui component configuration
- `.env` or `db/data/.env` - Environment configuration
- `db/data/.system-secrets/` - System encryption keys (NEVER commit)

## Environment Variables

- `PORT` - Backend HTTP port (default: 8080 in production, 30001 in dev)
- `SSL_PORT` - HTTPS port when SSL enabled (default: 8443)
- `DATA_DIR` - Database and data directory (default: `./db/data`)
- `VERSION` - Application version (falls back to package.json)
- `VITE_HTTPS` - Enable HTTPS in Vite dev server (requires SSL certs)

## Development Workflow

1. Start backend: `npm run dev:backend` (runs on port 30001)
2. Start frontend: `npm run dev` (runs on port 5173)
3. Access app at `http://localhost:5173/`
4. Frontend proxies API requests to backend via axios configuration
5. Make changes and hot reload applies automatically

## Git Workflow

- Use conventional commit format: `type: description` (e.g., `feat:`, `fix:`, `refactor:`)
- Create feature branches from main
- Keep commits focused and atomic
