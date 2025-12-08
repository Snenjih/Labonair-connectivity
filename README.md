# Labonair Connectivity

A modern SSH Host Manager extension for Visual Studio Code. Manage your SSH connections, credentials, and terminal sessions with a beautiful, Terminus-inspired interface.

![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC?style=flat-square&logo=visual-studio-code)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## ✨ Features

- **Host Management** — Add, edit, clone, and organize SSH hosts in folders
- **Quick Connect** — Connect to any host with `user@host:port` syntax
- **Credential Vault** — Securely store passwords and SSH keys
- **Modern UI** — Dark theme with responsive design
- **Bulk Actions** — Select multiple hosts for batch operations
- **Import/Export** — Share your host configurations as JSON
- **Port Forwarding** — Configure SSH tunnels per host
- **SFTP Support** — File manager with Explorer or Commander layout

## 🚀 Getting Started

### Prerequisites

- VS Code 1.80.0 or higher
- Node.js 18+ (for development)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/snenjih/labonair-connectivity.git
   cd labonair-connectivity
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run compile
   ```

4. Press `F5` in VS Code to launch the Extension Development Host

## 📦 Usage

1. Open the **Labonair** panel from the Activity Bar
2. Click **Add Host** to create your first SSH connection
3. Fill in the connection details (host, port, username, auth method)
4. Click **Save** and then **SSH** to connect

## ⌨️ Quick Connect

Use the quick connect input in the toolbar:
```
root@192.168.1.100:22
```

## 🔧 Configuration

### Host Settings

| Setting | Description |
|---------|-------------|
| Label | Display name for the host |
| Folder | Group hosts into folders |
| Protocol | SSH, Local Shell, or WSL |
| Auth Type | Password, Key File, Agent, or Vault |

### Terminal Settings

- Cursor style (Bar, Block, Underline)
- Cursor blinking

### File Manager Settings

- Layout (Explorer or Commander)
- Default view (Grid or List)
- Default paths

## 📁 Project Structure

```
src/
├── common/          # Shared types
├── extension/       # VS Code extension logic
│   ├── main.ts      # Extension entry point
│   ├── hostService.ts
│   └── credentialService.ts
└── webview/         # React UI
    ├── App.tsx
    ├── components/
    ├── views/
    └── styles/
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by Snenjih
