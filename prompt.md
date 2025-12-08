schau dir die folgenden datein an die sich im @Terminus-reference-folder befinden, diese datien gehören aus einer meiner apps namens terminus zum host manager du sollst alles zum host manager aus terminus dir anschauen und passend in diese extension hier integrieren, es soll das fast gleiche aussehen haben und fast alle funktionen, die umsetzung soll nur anders sein indem es statt einen eigenden backend für daten,key,hosts,credentials etc.  zu speichern soll dafür die logik der vs code api genutzt werden. Darauf sollst du entnehemen die funktionen, fürs das speichern,hinzufügen,bearbeiten von hosts, credentials, den hosts viewer also das man seine hosts sieht, den online status informationen, also alles was jetzt schon da ist nur überarbeitet und übernim größtenteils das design(nur angepast damit es in der sidebar auch funktioniert von vs code. und das vs code theme verwendet also die richtigen farben)

Hier ist eine detaillierte Auflistung aller Dateien in der Terminus Codebase, die direkt oder indirekt mit dem **Host Manager** (Verwaltung von SSH-Verbindungen) zu tun haben, kategorisiert nach ihrer Funktion:

### Frontend (Desktop UI - Hauptanwendung)

Diese Dateien bilden die eigentliche Benutzeroberfläche des Host Managers im Desktop-Browser/Electron.

*   **`src/ui/Desktop/Apps/Host Manager/HostManager.tsx`**
    Der Haupt-Container für den Host Manager, der die Tabs für die Ansicht (Liste) und das Bearbeiten/Erstellen von Hosts sowie die Credential-Verwaltung steuert.
*   **`src/ui/Desktop/Apps/Host Manager/HostManagerViewer.tsx`**
    Zeigt die Liste aller SSH-Hosts an, ermöglicht Suche, Gruppierung nach Ordnern und bietet Buttons für Aktionen wie Löschen, Bearbeiten, Klonen und Massenbearbeitung.
*   **`src/ui/Desktop/Apps/Host Manager/HostManagerEditor.tsx`**
    Das Formular zum Erstellen und Bearbeiten eines Hosts, inklusive Eingabefeldern für IP, Port, Authentifizierung (Passwort/Key/Credential), Tunnel-Konfiguration und Startup-Skripten.
*   **`src/ui/Desktop/Navigation/Hosts/Host.tsx`**
    Eine einzelne Komponente zur Darstellung eines Hosts in der Seitenleiste oder in Listen, inklusive Status-Indikator und Verbindungs-Buttons.
*   **`src/ui/Desktop/Navigation/Hosts/FolderCard.tsx`**
    Eine Komponente zur Darstellung von Ordnern, die mehrere Hosts gruppieren (für die Seitenleiste).
*   **`src/ui/Desktop/DesktopApp.tsx`**
    Die Haupt-Layout-Datei, die entscheidet, wann der `HostManager` angezeigt wird (z.B. wenn kein Tab offen ist).
*   **`src/ui/Desktop/Navigation/TopNavbar.tsx`**
    Enthält den "Home"-Button, der den Benutzer zurück zum Host Manager (Startansicht) bringt.

### Frontend (Modale & Hilfskomponenten)

Modale und Komponenten, die spezifische Funktionen innerhalb des Host Managers bereitstellen.

*   **`src/components/ui/QuickConnectModal.tsx`**
    Ein Such-Popup (Strg+K), das alle Hosts lädt und eine schnelle Verbindung ermöglicht, ohne den Host Manager direkt zu öffnen.
*   **`src/components/ui/AssignTagsModal.tsx`**
    Ein Modal für die Massenbearbeitung im Host Manager Viewer, um mehreren Hosts gleichzeitig Tags zuzuweisen.
*   **`src/components/ui/MoveToFolderModal.tsx`**
    Ein Modal für die Massenbearbeitung, um mehrere Hosts gleichzeitig in einen anderen Ordner zu verschieben.
*   **`src/components/ui/AssignTagsModal.tsx`**
    Ermöglicht das Zuweisen von Tags zu ausgewählten Hosts im Host Manager.

### Frontend (Logik & API-Calls)

Die Verbindung zwischen der Benutzeroberfläche und dem Backend.

*   **`src/ui/main-axios.ts`**
    Enthält alle Axios-HTTP-Anfragen an das Backend, wie `getSSHHosts`, `createSSHHost`, `updateSSHHost`, `deleteSSHHost`, `bulkImportSSHHosts` und Export-Funktionen.
*   **`src/types/index.ts`**
    Definiert die TypeScript-Interfaces `SSHHost` und `SSHHostData`, die die Struktur eines Hosts beschreiben.

### Backend (API & Datenbank)

Die serverseitige Logik zum Speichern und Abrufen der Host-Daten.

*   **`src/backend/database/routes/ssh.ts`**
    Die Express-Router-Datei, die Endpunkte wie `GET /ssh/db/host`, `POST /ssh/db/host` (Erstellen) und `DELETE /ssh/db/host/:id` bereitstellt.
*   **`src/backend/database/db/schema.ts`**
    Definiert das `sshData`-Datenbankschema (Tabelle), in dem alle Host-Informationen (IP, Port, User, verschlüsselte Passwörter) gespeichert werden.
*   **`src/backend/ssh/status-service.ts`**
    Ein Hintergrunddienst, der regelmäßig prüft, ob die gespeicherten Hosts online sind (Ping/SSH-Handshake) und den Status in der DB aktualisiert.
*   **`src/backend/utils/simple-db-ops.ts`**
    Hilfsfunktionen für Datenbankoperationen (Insert/Update/Select), die die automatische Verschlüsselung/Entschlüsselung der Host-Daten handhaben.

### Mobile UI

Die angepasste Ansicht für mobile Geräte.

*   **`src/ui/Mobile/Apps/Navigation/LeftSidebar.tsx`**
    Lädt und zeigt die Liste der SSH-Hosts in der mobilen Seitenleiste an.
*   **`src/ui/Mobile/Apps/Navigation/Hosts/FolderCard.tsx`**
    Mobile Version der Ordner-Darstellung für Hosts.
*   **`src/ui/Mobile/Apps/Navigation/Hosts/Host.tsx`**
    Mobile Version der einzelnen Host-Darstellung.

### VS Code Extension

Die Integration des Host Managers in Visual Studio Code.

*   **`vscode-extension/src/views/host-tree-provider.ts`**
    Implementiert den "Tree Data Provider", der die Hosts und Ordner in der VS Code Seitenleiste rendert.
*   **`vscode-extension/src/commands/host-commands.ts`**
    Enthält die Logik für VS Code Befehle wie `terminus.addHost`, `terminus.editHost`, `terminus.deleteHost` und `terminus.quickConnect`.
*   **`vscode-extension/src/views/webview-provider.ts`**
    Verwaltet die Webview, in der eine Verbindung zu einem Host geöffnet wird, wenn man im VS Code Host Manager darauf klickt.
*   **`vscode-extension/package.json`**
    Registriert die `terminus-hosts` View und die zugehörigen Befehle im VS Code Menü.

### Dokumentation

*   **`docs/03-Configs/json-import.md`**
    Beschreibt das JSON-Format, das im Host Manager für den Massenimport von Hosts verwendet wird.
*   **`openapi.json`**
    Dokumentiert die API-Endpunkte für "SSH Hosts", die vom Host Manager verwendet werden.


Ja, bei genauerer Betrachtung der Codebase gibt es noch weitere Dateien, die eng mit dem Host Manager verknüpft sind – insbesondere im Bereich **Datenverarbeitung (Import/Export)**, **Sicherheit**, **Übersetzung** und **Abhängigkeiten (Credentials)**.

Hier ist die Ergänzung:

### Backend: Daten-Verarbeitung & Sicherheit

Diese Dateien regeln, wie die im Host Manager erstellten Daten (Passwörter, Keys) geschützt oder exportiert werden.

*   **`src/backend/utils/user-data-import.ts`**
    Verarbeitet den Import von Benutzerdaten, enthält spezifische Logik (`importSshHosts`), um Hosts aus Backup-Dateien in die Datenbank `ssh_data` einzufügen.
*   **`src/backend/utils/user-data-export.ts`**
    Zuständig für den Export, liest die `ssh_data` Tabelle aus, entschlüsselt die Daten (wenn angefordert) und verpackt sie in eine JSON/SQLite-Datei.
*   **`src/backend/config/sensitive-fields.ts`**
    Definiert in der Konfiguration `ssh_data`, welche Felder (z.B. `password`, `key`) als sensibel gelten und vor der Speicherung in der Datenbank verschlüsselt werden müssen.

### Frontend: Abhängigkeiten & Komponenten

Komponenten, die im Host-Editor verwendet werden, aber eigentlich zu anderen Modulen gehören.

*   **`src/ui/Desktop/Apps/Credentials/CredentialSelector.tsx`**
    Das Dropdown-Menü im `HostManagerEditor.tsx`, mit dem man statt eines Passworts ein gespeichertes Credential (Anmeldedaten) auswählen kann.
*   **`src/ui/Desktop/Apps/Credentials/CredentialsManager.tsx`**
    Wird direkt im `HostManager.tsx` als eigener Tab geladen, da Hosts und Credentials eng miteinander verknüpft verwaltet werden.

### Lokalisierung (Übersetzungen)

Ohne diese Dateien wäre die Benutzeroberfläche des Host Managers leer oder fehlerhaft beschriftet.

*   **`src/locales/en/translation.json`**
    Enthält im Abschnitt `"hosts": { ... }` alle englischen Texte für den Host Manager (z.B. "Add Host", "IP Address", "Connection Details").
*   **`src/locales/de/translation.json`**
    Die deutsche Übersetzung aller Texte des Host Managers.
