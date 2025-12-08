import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface Editor {
  name: string;
  path: string;
  icon?: string;
}

/**
 * Launch an external editor with the given file
 * @param filePath - Absolute path to the file to open
 * @param editorPath - Optional path to the editor executable
 * @returns Process instance
 */
export async function launchEditor(
  filePath: string,
  editorPath?: string
): Promise<ChildProcess> {
  if (editorPath) {
    // Use specified editor
    return spawn(editorPath, [filePath], {
      detached: true,
      stdio: 'ignore'
    });
  } else {
    // Use system default editor
    return launchDefaultEditor(filePath);
  }
}

/**
 * Launch the system's default editor
 * @param filePath - Absolute path to the file to open
 * @returns Process instance
 */
function launchDefaultEditor(filePath: string): ChildProcess {
  const platform = os.platform();

  if (platform === 'win32') {
    // Windows: Use 'start' command
    return spawn('cmd', ['/c', 'start', '', filePath], {
      detached: true,
      stdio: 'ignore'
    });
  } else if (platform === 'darwin') {
    // macOS: Use 'open' command with TextEdit
    return spawn('open', ['-e', filePath], {
      detached: true,
      stdio: 'ignore'
    });
  } else {
    // Linux: Try xdg-open or $EDITOR
    const editor = process.env.EDITOR || 'xdg-open';
    return spawn(editor, [filePath], {
      detached: true,
      stdio: 'ignore'
    });
  }
}

/**
 * Detect installed text editors on the system
 * @returns Array of detected editors
 */
export async function detectInstalledEditors(): Promise<Editor[]> {
  const platform = os.platform();
  const editors: Editor[] = [];

  if (platform === 'win32') {
    editors.push(...await detectWindowsEditors());
  } else if (platform === 'darwin') {
    editors.push(...await detectMacOSEditors());
  } else {
    editors.push(...await detectLinuxEditors());
  }

  return editors;
}

/**
 * Detect text editors on Windows
 */
async function detectWindowsEditors(): Promise<Editor[]> {
  const editors: Editor[] = [];

  const commonPaths = [
    // VS Code
    {
      name: 'Visual Studio Code',
      paths: [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe'),
        path.join(process.env.ProgramFiles || '', 'Microsoft VS Code', 'Code.exe'),
        'code'
      ]
    },
    // Sublime Text
    {
      name: 'Sublime Text',
      paths: [
        path.join(process.env.ProgramFiles || '', 'Sublime Text', 'sublime_text.exe'),
        path.join(process.env.ProgramFiles || '', 'Sublime Text 3', 'sublime_text.exe'),
        'subl'
      ]
    },
    // Notepad++
    {
      name: 'Notepad++',
      paths: [
        path.join(process.env.ProgramFiles || '', 'Notepad++', 'notepad++.exe'),
        path.join(process.env['ProgramFiles(x86)'] || '', 'Notepad++', 'notepad++.exe')
      ]
    },
    // Atom
    {
      name: 'Atom',
      paths: [
        path.join(process.env.LOCALAPPDATA || '', 'atom', 'bin', 'atom.cmd'),
        'atom'
      ]
    }
  ];

  for (const editor of commonPaths) {
    for (const editorPath of editor.paths) {
      if (await fileExists(editorPath)) {
        editors.push({ name: editor.name, path: editorPath });
        break;
      }
    }
  }

  return editors;
}

/**
 * Detect text editors on macOS
 */
async function detectMacOSEditors(): Promise<Editor[]> {
  const editors: Editor[] = [];

  const commonPaths = [
    // VS Code
    {
      name: 'Visual Studio Code',
      paths: [
        '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
        '/usr/local/bin/code',
        'code'
      ]
    },
    // Sublime Text
    {
      name: 'Sublime Text',
      paths: [
        '/Applications/Sublime Text.app/Contents/SharedSupport/bin/subl',
        '/usr/local/bin/subl',
        'subl'
      ]
    },
    // TextMate
    {
      name: 'TextMate',
      paths: [
        '/Applications/TextMate.app/Contents/Resources/mate',
        '/usr/local/bin/mate',
        'mate'
      ]
    },
    // Atom
    {
      name: 'Atom',
      paths: [
        '/Applications/Atom.app/Contents/Resources/app/atom.sh',
        '/usr/local/bin/atom',
        'atom'
      ]
    },
    // BBEdit
    {
      name: 'BBEdit',
      paths: [
        '/Applications/BBEdit.app/Contents/Helpers/bbedit_tool',
        '/usr/local/bin/bbedit',
        'bbedit'
      ]
    }
  ];

  for (const editor of commonPaths) {
    for (const editorPath of editor.paths) {
      if (await fileExists(editorPath)) {
        editors.push({ name: editor.name, path: editorPath });
        break;
      }
    }
  }

  return editors;
}

/**
 * Detect text editors on Linux
 */
async function detectLinuxEditors(): Promise<Editor[]> {
  const editors: Editor[] = [];

  const commonPaths = [
    // VS Code
    {
      name: 'Visual Studio Code',
      paths: [
        '/usr/bin/code',
        '/usr/local/bin/code',
        'code'
      ]
    },
    // Sublime Text
    {
      name: 'Sublime Text',
      paths: [
        '/usr/bin/subl',
        '/usr/local/bin/subl',
        'subl'
      ]
    },
    // Gedit
    {
      name: 'Gedit',
      paths: [
        '/usr/bin/gedit',
        'gedit'
      ]
    },
    // Kate
    {
      name: 'Kate',
      paths: [
        '/usr/bin/kate',
        'kate'
      ]
    },
    // Atom
    {
      name: 'Atom',
      paths: [
        '/usr/bin/atom',
        '/usr/local/bin/atom',
        'atom'
      ]
    },
    // Vim
    {
      name: 'Vim',
      paths: [
        '/usr/bin/vim',
        'vim'
      ]
    },
    // NeoVim
    {
      name: 'NeoVim',
      paths: [
        '/usr/bin/nvim',
        'nvim'
      ]
    },
    // Emacs
    {
      name: 'Emacs',
      paths: [
        '/usr/bin/emacs',
        'emacs'
      ]
    }
  ];

  for (const editor of commonPaths) {
    for (const editorPath of editor.paths) {
      if (await fileExists(editorPath)) {
        editors.push({ name: editor.name, path: editorPath });
        break;
      }
    }
  }

  return editors;
}

/**
 * Check if a file exists
 * @param filePath - Path to check
 * @returns True if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate if an editor path is valid
 * @param editorPath - Path to the editor
 * @returns True if valid
 */
export async function validateEditorPath(editorPath: string): Promise<boolean> {
  if (!editorPath) return false;

  // Check if it's in PATH (command name only, no path separators)
  if (!editorPath.includes(path.sep)) {
    return true; // Assume it's in PATH, will fail at launch if not
  }

  // Check if file exists and is executable
  return await fileExists(editorPath);
}
