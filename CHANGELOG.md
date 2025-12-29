# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### Added
- GitHub Workflows für automatisiertes Deployment
- Wöchentliche Bereinigung alter Artifacts

## [0.0.1] - 2025-12-29

### Added
- Initiale Release-Version
- SSH/SFTP Management mit Terminus-inspiriertem Interface
- Dual-Architecture Pattern (Extension Host + React Webview)
- Connection Pool für gemeinsame SSH-Verbindungen
- Host Manager Sidebar-Ansicht
- SFTP File Browser im Editor
- SSH Terminal im Editor
- Transfer Queue für Dateiübertragungen
- Edit-on-Fly für Remote-Dateien
- Host Key Verification und Storage
- Sichere Credential-Verwaltung via VS Code SecretStorage
- Quick Connect via `user@host:port` Syntax

### Features
- **Host Management**: Vollständige CRUD-Operationen für SSH-Hosts
- **Terminal**: Integrierter SSH-Terminal mit xterm.js
- **File Manager**: SFTP-Browser mit Upload/Download-Funktionalität
- **Transfer Queue**: Echtzeit-Überwachung von Dateiübertragungen
- **Security**: SSH-Schlüssel-Unterstützung, Host-Key-Verifizierung
- **Authentication**: Passwort, SSH-Key, SSH-Agent, gespeicherte Credentials

### Technical
- TypeScript 5.3.3
- React 18.2.0
- Webpack Dual-Bundle System
- VS Code API 1.85.0
- ssh2 1.15.0 für SSH/SFTP
- xterm 5.5.0 für Terminal-Emulation

---

## Versionierung

- **MAJOR** Version bei inkompatiblen API-Änderungen
- **MINOR** Version bei neuen, abwärtskompatiblen Funktionalitäten
- **PATCH** Version bei abwärtskompatiblen Bugfixes

## Kategorien

- `Added` für neue Features
- `Changed` für Änderungen an bestehenden Funktionalitäten
- `Deprecated` für Features, die in kommenden Versionen entfernt werden
- `Removed` für entfernte Features
- `Fixed` für Bugfixes
- `Security` für Sicherheitsupdates
