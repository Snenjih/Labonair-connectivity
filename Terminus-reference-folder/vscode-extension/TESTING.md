# Testing Guide - Terminus VS Code Extension

Comprehensive testing documentation for the Terminus VS Code extension covering all features, platforms, and scenarios.

## Table of Contents

- [Local Development Testing](#local-development-testing)
- [Backend Testing](#backend-testing)
- [TreeView Testing](#treeview-testing)
- [Command Testing](#command-testing)
- [Webview Testing](#webview-testing)
- [Multi-Instance Testing](#multi-instance-testing)
- [Zombie Process Testing](#zombie-process-testing)
- [SecretStorage Testing](#secretstorage-testing)
- [Platform-Specific Testing](#platform-specific-testing)
- [Manual Testing Checklist](#manual-testing-checklist)
- [Week 2 Features (TreeView and Commands)](#week-2-features-treeview-and-host-commands)

## Pre-Testing Setup

### Environment Requirements
- VS Code 1.85.0 or higher
- Node.js 18+
- Terminus backend running or available
- SSH server access for connection testing (optional)

### Initial Setup
1. Clone the repository
2. Run `npm install` in the root and `vscode-extension` directories
3. Run `npm run build` in root to compile TypeScript
4. Open VS Code with extension development host:
   ```bash
   cd vscode-extension
   code --extensionDevelopmentPath=$(pwd)
   ```
5. Open the Terminus Output Channel: View → Output → Select "Terminus Backend"
6. Monitor logs during testing

## Feature 1: Extension Activation

### Test: Activation Sequence
**Expected**: Extension activates, backend starts, tree view appears

Steps:
1. Open extension development VS Code window
2. Click Terminus icon in Activity Bar (left sidebar)
3. Observe Output Channel for startup messages

**Success Criteria**:
- ✅ Terminus TreeView appears in sidebar with SSH Hosts
- ✅ Output shows "Backend started successfully on port XXXXX"
- ✅ Output shows "Terminus extension activated successfully"
- ✅ No error messages in Output Channel

### Test: Backend Health Check
**Expected**: Backend responds to health checks

Steps:
1. Keep extension running for 30 seconds
2. Check backend logs in Output Channel
3. Verify periodic health check messages

**Success Criteria**:
- ✅ Backend process is running (visible in output)
- ✅ Health checks pass (if logged)
- ✅ No restart attempts or failures

---

## Feature 2: TreeView Display

### Test: Empty Host List
**Expected**: TreeView shows empty state when no hosts configured

Steps:
1. Activate extension (fresh install)
2. Look at Terminus SSH Hosts view

**Success Criteria**:
- ✅ TreeView displays with no folders/hosts
- ✅ "+" button (Add Host) is visible in title bar
- ✅ Refresh button is visible

### Test: Folder Organization
**Expected**: Hosts are grouped by folder, alphabetically sorted

Setup:
1. Add hosts in this order via API or CLI:
   - Host A in folder "Servers"
   - Host B in folder "Staging"
   - Host C with no folder (goes to "Uncategorized")
   - Host D in folder "Production"

Steps:
1. View TreeView

**Success Criteria**:
- ✅ Folders appear in order: Production, Servers, Staging, Uncategorized
- ✅ Correct number of hosts in each folder
- ✅ Folder descriptions show host count (e.g., "Production - 1 host")
- ✅ Clicking folder expands/collapses to show hosts

### Test: Host Display
**Expected**: Individual hosts show connection info in description

Setup:
1. Add a host via API:
   ```json
   {
     "hostname": "Test Server",
     "host": "192.168.1.100",
     "port": 2222,
     "username": "testuser",
     "folder": "Test"
   }
   ```

Steps:
1. Expand "Test" folder in TreeView
2. Hover over "Test Server" host

**Success Criteria**:
- ✅ Host shows label "Test Server"
- ✅ Description shows "testuser@192.168.1.100:2222"
- ✅ Tooltip shows:
  - Hostname: Test Server
  - Address: testuser@192.168.1.100:2222
  - Folder: Test
- ✅ Host has "vm" icon

### Test: Host with Tags and Notes
**Expected**: Tooltip includes all metadata

Setup:
1. Create host via API with all fields:
   ```json
   {
     "hostname": "Full Host",
     "host": "server.example.com",
     "port": 22,
     "username": "admin",
     "tags": ["prod", "critical"],
     "notes": "Primary web server",
     "folder": "Production"
   }
   ```

Steps:
1. Expand folder and hover over host

**Success Criteria**:
- ✅ Tooltip includes:
  - Tags: prod, critical
  - Notes section with "Primary web server"
  - All other standard fields

### Test: TreeView Refresh
**Expected**: Refresh button updates host list

Setup:
1. Have some hosts in TreeView
2. Add a new host via API (outside extension)

Steps:
1. Click Refresh button in TreeView title bar
2. Observe TreeView updates

**Success Criteria**:
- ✅ New host appears in TreeView
- ✅ Folder structure updates correctly
- ✅ No errors in Output Channel
- ✅ Refresh completes in <2 seconds

### Test: Error Handling in TreeView
**Expected**: Graceful error handling when API fails

Setup:
1. Start extension with backend running
2. Stop backend or block network connection
3. Trigger tree refresh

Steps:
1. Click Refresh button
2. Observe error handling

**Success Criteria**:
- ✅ Error message shown to user
- ✅ Output Channel shows detailed error
- ✅ TreeView doesn't crash, displays empty or cached state
- ✅ User can retry refresh

---

## Feature 3: Add Host Command

### Test: Basic Host Addition
**Expected**: New host created successfully with minimal input

Steps:
1. Click "+" button in TreeView title bar (or use Terminus: Add New Host from Command Palette)
2. Input prompts:
   - Hostname: "My Server"
   - Host: "192.168.1.100"
   - Port: (accept default 22)
   - Username: "ubuntu"
   - Auth Method: "Password"
   - Password: "test123"

**Success Criteria**:
- ✅ No validation errors
- ✅ Success message: 'Host "My Server" added successfully!'
- ✅ Host appears in TreeView under Uncategorized
- ✅ Output Channel logs: "Created host: My Server (ubuntu@192.168.1.100:22)"

### Test: Port Validation
**Expected**: Port input validated as number 1-65535

Steps:
1. Start Add Host command
2. At Port prompt:
   - Try: "abc" (invalid)
   - Try: "0" (invalid)
   - Try: "99999" (invalid)
   - Try: "2222" (valid)

**Success Criteria**:
- ✅ Invalid inputs show error: "Port must be a number between 1 and 65535"
- ✅ Valid port accepted and command continues
- ✅ Command doesn't proceed until valid input given

### Test: Required Fields
**Expected**: Hostname and username are required

Steps:
1. Start Add Host command
2. At Hostname prompt: Leave empty and press Enter
3. At Host prompt: Leave empty and press Enter
4. At Username prompt: Leave empty and press Enter

**Success Criteria**:
- ✅ Error shown: "Hostname is required"
- ✅ Error shown: "Host address is required"
- ✅ Error shown: "Username is required"
- ✅ Prompt repeats until valid input

### Test: Command Cancellation
**Expected**: User can cancel at any prompt

Steps:
1. Start Add Host command
2. At first prompt, press Escape

**Success Criteria**:
- ✅ Command cancels cleanly
- ✅ No host created
- ✅ No error message (just closes)

### Test: No Authentication
**Expected**: User can skip auth configuration

Steps:
1. Start Add Host command
2. Enter host details
3. At Auth Method, select "None (configure later)"

**Success Criteria**:
- ✅ Host created without password/key
- ✅ Success message shown
- ✅ Host appears in TreeView

### Known Limitation ⚠️
**Currently Unsupported** (Phase 2 enhancement):
- Private key input (prompts but not saved)
- Folder assignment
- Tags
- Notes field

---

## Feature 4: Edit Host Command

### Test: Edit Hostname
**Expected**: Hostname can be edited via context menu

Setup:
1. Have a host in TreeView: "Old Name"

Steps:
1. Right-click host → "Edit Host"
2. In hostname prompt, change to "New Name"
3. Confirm

**Success Criteria**:
- ✅ TreeView updates to show "New Name"
- ✅ Success message: "Host updated successfully!"
- ✅ Output logs the change

### Test: No Change
**Expected**: No update if same hostname entered

Setup:
1. Have host "Test Server"

Steps:
1. Right-click → Edit Host
2. At prompt, keep same hostname and press Enter

**Success Criteria**:
- ✅ Command completes without update
- ✅ No success message
- ✅ No API call made

### Test: Edit Validation
**Expected**: Hostname validation same as Add Host

Steps:
1. Right-click host → Edit Host
2. Clear hostname and press Enter

**Success Criteria**:
- ✅ Error: "Hostname is required"
- ✅ Can retry input

### Known Limitation ⚠️
**Currently Limited** (Phase 2 enhancement):
- Only edits hostname
- Should support editing all fields (host, port, username, folder, tags, notes)
- Should be webview form, not sequential prompts

---

## Feature 5: Delete Host Command

### Test: Delete with Confirmation
**Expected**: Confirmation required before deletion

Setup:
1. Have a test host: "Deleteme"

Steps:
1. Right-click host → "Delete Host"
2. Confirm dialog shown
3. Click "Delete"

**Success Criteria**:
- ✅ Confirmation dialog: "Delete host "Deleteme"?"
- ✅ "Delete" button visible
- ✅ Success message: 'Host "Deleteme" deleted successfully!'
- ✅ Host removed from TreeView
- ✅ Output logs deletion

### Test: Delete Cancellation
**Expected**: Delete can be cancelled

Steps:
1. Right-click host → "Delete Host"
2. Confirmation shown
3. Press Escape or click elsewhere

**Success Criteria**:
- ✅ Host NOT deleted
- ✅ TreeView unchanged
- ✅ No log entries

### Test: Error Handling
**Expected**: Errors shown if deletion fails

Setup:
1. Have a host
2. Backend offline/unreachable

Steps:
1. Right-click → Delete
2. Confirm deletion

**Success Criteria**:
- ✅ Error message shown to user
- ✅ Output shows detailed error
- ✅ Host remains in TreeView

---

## Feature 6: Duplicate Host Command

### Test: Successful Duplication
**Expected**: Host duplicated with new ID

Setup:
1. Have host "Original" with specific config:
   - Username: testuser
   - Port: 2222
   - Folder: Servers

Steps:
1. Right-click "Original" → "Duplicate Host"

**Success Criteria**:
- ✅ Success message shown
- ✅ New host appears in TreeView (in same folder "Servers")
- ✅ New host has same config (username, port, etc.)
- ✅ Has different ID
- ✅ Output logs duplication

### Test: Duplicate Naming
**Expected**: Duplicated host may have modified name

Steps:
1. Duplicate "My Server"

**Success Criteria**:
- ✅ New host created (name may be "My Server Copy" or similar)
- ✅ Both hosts visible in TreeView

### Test: Error on Duplication
**Expected**: Errors properly handled

Setup:
1. Backend offline

Steps:
1. Right-click host → Duplicate

**Success Criteria**:
- ✅ Error message shown
- ✅ Output shows error details
- ✅ No duplicate created

---

## Feature 7: Export Host Command

### Test: Export to JSON
**Expected**: Host exported as JSON file

Setup:
1. Have host with full config:
   ```
   Hostname: Production Server
   Host: server.prod.com
   Port: 22
   Username: deploy
   ```

Steps:
1. Right-click host → "Export Host Config"
2. Save dialog opens
3. Accept default name or change to "server-config.json"
4. Save to Desktop

**Success Criteria**:
- ✅ Save dialog opens with filename suggestion
- ✅ File saved successfully
- ✅ Success message with file path shown
- ✅ JSON file contains host configuration
- ✅ JSON is readable and valid

### Test: Export File Content
**Expected**: Exported JSON has correct structure

Steps:
1. Export host as above
2. Open saved JSON in text editor

**Success Criteria**:
- ✅ Valid JSON format
- ✅ Contains fields: id, hostname, host, port, username, folder, tags, etc.
- ✅ Sensitive data (password, keys) may be encrypted or stripped

### Test: Overwrite Protection
**Expected**: Can overwrite existing file

Steps:
1. Export host to "test.json"
2. Export another host, also name "test.json"
3. File exists dialog shown
4. Choose to overwrite

**Success Criteria**:
- ✅ Second host exports successfully
- ✅ File updated

### Test: Export Cancellation
**Expected**: Can cancel export

Steps:
1. Right-click host → Export
2. Save dialog opens
3. Press Escape or click Cancel

**Success Criteria**:
- ✅ Export cancelled
- ✅ No file created
- ✅ No error message

---

## Feature 8: Quick Connect Command

### Test: Quick Connect Selection
**Expected**: Can select host from quick picker

Setup:
1. Have multiple hosts: "Dev", "Staging", "Prod"

Steps:
1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Type "Quick Connect"
3. Select "Terminus: Quick Connect"
4. Quick picker shows all hosts
5. Click "Staging"

**Success Criteria**:
- ✅ Quick picker shows all hosts
- ✅ Each host shows description: "username@host:port"
- ✅ Each host shows folder as detail
- ✅ Selecting host opens host in webview (if webview implemented)

### Test: Empty Host List
**Expected**: Message shown if no hosts

Setup:
1. No hosts configured

Steps:
1. Command Palette → Quick Connect

**Success Criteria**:
- ✅ Message: "No hosts configured. Add a host first."
- ✅ Quick picker doesn't appear

### Test: Quick Connect Cancellation
**Expected**: Can dismiss quick picker

Steps:
1. Open Quick Connect
2. Press Escape

**Success Criteria**:
- ✅ Picker closes
- ✅ No action taken
- ✅ No error

### Test: Error Handling
**Expected**: Errors shown if host load fails

Setup:
1. Backend offline

Steps:
1. Quick Connect

**Success Criteria**:
- ✅ Error message: "Failed to load hosts: ..."
- ✅ Output shows error details

---

## Feature 9: Create Tunnel Command

### Test: Tunnel Creation
**Expected**: SSH tunnel created successfully

Setup:
1. Have a host "database-server"

Steps:
1. Right-click host → "Create SSH Tunnel"
2. Input prompts:
   - Tunnel name: "PostgreSQL Proxy"
   - Local port: "5432"
   - Remote host: "localhost"
   - Remote port: "5432"

**Success Criteria**:
- ✅ Success message: 'Tunnel "PostgreSQL Proxy" created successfully!'
- ✅ Output logs: "Created tunnel: PostgreSQL Proxy..."
- ✅ Tunnel appears in host's tunnel list

### Test: Port Validation
**Expected**: Local/remote ports validated

Steps:
1. Start Create Tunnel
2. At port prompts, try invalid values:
   - "abc"
   - "0"
   - "99999"

**Success Criteria**:
- ✅ Error: "Port must be a number between 1 and 65535"
- ✅ Can retry until valid

### Test: Tunnel Cancellation
**Expected**: Can cancel tunnel creation

Steps:
1. Start Create Tunnel
2. At first prompt, press Escape

**Success Criteria**:
- ✅ Command cancelled
- ✅ No tunnel created

### Test: Default Values
**Expected**: Remote host defaults to localhost

Steps:
1. Start Create Tunnel
2. At remote host prompt, press Enter (accept default)

**Success Criteria**:
- ✅ "localhost" accepted as default
- ✅ Command continues

### Known Limitation ⚠️
**Currently Missing** (Phase 2 enhancement):
- Doesn't verify port availability
- Doesn't query tunnel status
- Doesn't refresh tunnel list after creation
- No tunnel management UI

---

## Feature 10: Refresh Hosts Command

### Test: Manual Refresh
**Expected**: Refresh updates host list

Setup:
1. Have hosts in TreeView
2. Add a new host via API (external tool)

Steps:
1. Click Refresh button in TreeView title bar
2. Or: Command Palette → "Refresh Host List"

**Success Criteria**:
- ✅ New host appears in TreeView
- ✅ Tree structure updates
- ✅ Refresh completes quickly (<2 seconds)

### Test: Refresh During Load
**Expected**: Multiple refreshes don't cause issues

Steps:
1. Click Refresh button
2. Immediately click again before first completes

**Success Criteria**:
- ✅ Second request queued/debounced
- ✅ No errors
- ✅ Final result is correct

---

## Feature 11: TreeView Item Context Menu

### Test: Host Context Menu
**Expected**: All menu items appear for host

Setup:
1. Have a host in TreeView

Steps:
1. Right-click host

**Success Criteria**:
- ✅ Menu shows all items:
  - Open Host (navigation group)
  - Edit Host (management group)
  - Duplicate Host (management group)
  - Export Host (management group)
  - Create SSH Tunnel (actions group)
  - Delete Host (danger group)

### Test: Context Menu Separation
**Expected**: Menu items properly grouped

Observation during above test:
- ✅ Navigation group appears first
- ✅ Management group appears second
- ✅ Actions group appears third
- ✅ Danger group (delete) appears last

---

## Feature 12: API Authentication

### Test: Token Storage
**Expected**: JWT token stored securely

Steps:
1. Login via webview or API
2. Create/retrieve a host

**Success Criteria**:
- ✅ Token stored in VS Code SecretStorage
- ✅ Subsequent requests include Authorization header
- ✅ Token persists across commands

### Test: Token Expiration
**Expected**: Expired token handled gracefully

Setup:
1. Login and get token
2. Wait for token to expire (or manually set invalid token)

Steps:
1. Try to get hosts

**Success Criteria**:
- ✅ 401 error handled
- ✅ Token cleared from storage
- ✅ User prompted to login again
- ✅ No cryptic errors shown

### Test: No Token Scenario
**Expected**: API errors for unauthenticated requests

Setup:
1. Clear token from storage (or fresh install)

Steps:
1. Try to get hosts

**Success Criteria**:
- ✅ 401 error shown
- ✅ User prompted to authenticate
- ✅ Clear message: "Authentication required"

---

## Error Scenarios

### Test: Network Unreachable
**Expected**: Network errors handled

Setup:
1. Turn off network or block backend port

Steps:
1. Try any command (add host, refresh, etc.)

**Success Criteria**:
- ✅ Error message shown
- ✅ Output shows network error details
- ✅ No crash or hung UI
- ✅ User can retry

### Test: Malformed Response
**Expected**: Invalid API responses handled

Setup:
1. Backend modified to return invalid JSON
2. Try to get hosts

**Success Criteria**:
- ✅ Error message shown
- ✅ Output shows parse error
- ✅ Extension doesn't crash

### Test: Server 500 Error
**Expected**: Server errors propagated

Setup:
1. Trigger server error (invalid data, etc.)

Steps:
1. Try operation that causes error

**Success Criteria**:
- ✅ Error message shown to user
- ✅ Output includes HTTP status and error details
- ✅ Suggestion for retry or contact support

---

## Performance Tests

### Test: Large Host List
**Expected**: TreeView responsive with many hosts

Setup:
1. Create 100+ hosts via API
2. Distribute across folders

Steps:
1. Activate extension
2. View TreeView
3. Expand folders
4. Perform operations (delete, duplicate, etc.)

**Success Criteria**:
- ✅ TreeView loads in reasonable time (<5 seconds)
- ✅ Folder operations responsive
- ✅ No UI lag
- ✅ Refresh completes in <3 seconds

### Test: Concurrent Operations
**Expected**: Multiple commands work simultaneously

Steps:
1. Start Add Host command
2. While prompts open, refresh TreeView via button
3. Open Quick Connect
4. Switch between windows

**Success Criteria**:
- ✅ All operations proceed without interference
- ✅ Commands don't block UI
- ✅ Proper handling of concurrent API calls

---

## Accessibility Tests

### Test: Keyboard Navigation
**Expected**: All features accessible via keyboard

Steps:
1. Close mouse
2. Use only keyboard:
   - Tab to navigate TreeView
   - Space/Enter to expand folders
   - Context menu (Alt+Click equivalent)
   - Command Palette (Ctrl+Shift+P)

**Success Criteria**:
- ✅ All features accessible
- ✅ Focus indicators visible
- ✅ No keyboard traps

### Test: Screen Reader
**Expected**: Accessible labels and descriptions

Steps:
1. Open screen reader (NVDA, JAWS, etc.)
2. Navigate TreeView and menus

**Success Criteria**:
- ✅ Host names announced
- ✅ Folder count announced
- ✅ Button purposes clear
- ✅ Error messages readable

---

## Integration Tests

### Test: Host → Webview → Terminal
**Expected**: Full flow from TreeView to terminal

Steps:
1. Add host
2. Click host in TreeView
3. Webview opens with tabs (Terminal, Files, Tunnels)
4. Click Terminal tab
5. Terminal session should show

**Success Criteria**:
- ✅ Webview opens in editor
- ✅ Proper host info passed to webview
- ✅ Terminal tab functional

### Test: File Manager Integration
**Expected**: File operations work from TreeView

Setup:
1. Have a connected host

Steps:
1. Click host → Files tab
2. List files
3. Create new folder
4. Delete a file

**Success Criteria**:
- ✅ Files displayed correctly
- ✅ CRUD operations work
- ✅ Changes reflected immediately

---

## Regression Tests

### Test: Extension After Update
**Expected**: Extension still works after reloading

Steps:
1. Have active extension
2. Reload window (Cmd+R / Ctrl+R)
3. Check Terminus view

**Success Criteria**:
- ✅ Extension reactivates
- ✅ Backend restarts
- ✅ TreeView populated again
- ✅ No data loss

### Test: Multiple VS Code Windows
**Expected**: Each window has independent extension instance

Steps:
1. Open Terminus in VS Code window 1
2. Open second VS Code window
3. Activate extension there too

**Success Criteria**:
- ✅ Both windows have independent Terminus instances
- ✅ Each connects to its own backend (or detects existing)
- ✅ No interference between windows

---

## Test Results Template

Copy this template for each test run:

```
## Test Run: [Date] [Tester Name]

### Environment
- OS: [Windows/macOS/Linux]
- VS Code Version: [version]
- Node Version: [version]
- Backend Status: [Running/Mock/N/A]

### Results Summary
- Total Tests: X
- Passed: X
- Failed: X
- Skipped: X

### Failed Tests
[List any failures with details]

### Notes
[Additional observations]
```

---

## Automated Testing (Future)

### Unit Tests (Jest)
- API Client authentication interceptor
- Error handling for various status codes
- Type validation of API responses
- Storage Manager encryption/decryption

### Integration Tests
- End-to-end host creation flow
- TreeView refresh and updates
- Error recovery scenarios

### E2E Tests (Playwright)
- Full user workflows
- UI responsiveness
- Command execution
- Keyboard shortcuts

**Implementation**: Planned for Phase 2

---

## Test Execution Timeline

- **Smoke Tests**: 15 minutes (basic activation and TreeView)
- **Feature Tests**: 2 hours (all commands)
- **Error Scenarios**: 30 minutes
- **Performance Tests**: 30 minutes
- **Total**: ~3 hours for full test cycle

---

**Last Updated**: 2025-12-02
**Status**: Testing guide complete, ready for execution
