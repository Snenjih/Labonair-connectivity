import React, { useState, useEffect, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { SSHHost } from "../../../../types";
import { readRemoteFileContent, saveRemoteFileContent } from "../../../main-axios";
import { Save, Loader2, AlertCircle, X } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { registerMonacoTheme } from "../../../utils/editor-theme-adapter";

interface RemoteEditorProps {
  filePath: string;
  sshSessionId: string;
  sshHost: SSHHost;
  onClose: () => void;
}

const RemoteEditor: React.FC<RemoteEditorProps> = ({
  filePath,
  sshSessionId,
  sshHost,
  onClose,
}) => {
  const { t } = useTranslation();
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [fileInfo, setFileInfo] = useState<{
    fileName: string;
    size: number;
    encoding: string;
    mimeType: string;
  } | null>(null);
  const [editorTheme, setEditorTheme] = useState<string>("vs-dark");

  const editorRef = useRef<any>(null);
  const fileName = filePath.split("/").pop() || "file";

  // Determine language from file extension
  const getLanguage = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      json: "json",
      html: "html",
      htm: "html",
      css: "css",
      scss: "scss",
      sass: "sass",
      less: "less",
      md: "markdown",
      py: "python",
      java: "java",
      c: "c",
      cpp: "cpp",
      h: "c",
      hpp: "cpp",
      cs: "csharp",
      php: "php",
      rb: "ruby",
      go: "go",
      rs: "rust",
      sh: "shell",
      bash: "shell",
      zsh: "shell",
      fish: "shell",
      ps1: "powershell",
      yaml: "yaml",
      yml: "yaml",
      toml: "toml",
      xml: "xml",
      sql: "sql",
      r: "r",
      swift: "swift",
      kt: "kotlin",
      vue: "vue",
      svelte: "svelte",
      dockerfile: "dockerfile",
      ini: "ini",
      conf: "ini",
      txt: "plaintext",
    };
    return languageMap[ext || ""] || "plaintext";
  };

  // Load file content
  useEffect(() => {
    const loadFile = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await readRemoteFileContent(
          sshSessionId,
          filePath,
          sshHost.id,
          undefined
        );

        setContent(response.content);
        setOriginalContent(response.content);
        setFileInfo({
          fileName: response.fileName,
          size: response.size,
          encoding: response.encoding,
          mimeType: response.mimeType,
        });
      } catch (err: any) {
        console.error("Failed to load file:", err);
        const errorMsg = err?.message || "Failed to load file";
        setError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath, sshSessionId, sshHost.id]);

  // Handle content changes
  const handleEditorChange = useCallback((value: string | undefined) => {
    const newContent = value || "";
    setContent(newContent);
    setIsDirty(newContent !== originalContent);
  }, [originalContent]);

  // Save file
  const handleSave = useCallback(async () => {
    if (!isDirty) {
      toast.info("No changes to save");
      return;
    }

    try {
      setSaving(true);

      const response = await saveRemoteFileContent(
        sshSessionId,
        filePath,
        content,
        sshHost.id,
        undefined
      );

      if (response.success) {
        setOriginalContent(content);
        setIsDirty(false);
        toast.success(`File saved successfully: ${response.fileName}`);
      } else {
        throw new Error("Save operation did not return success");
      }
    } catch (err: any) {
      console.error("Failed to save file:", err);
      const errorMsg = err?.message || "Failed to save file";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  }, [content, sshSessionId, filePath, sshHost.id, isDirty]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // Warn before closing with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Handle close button with confirmation
  const handleCloseClick = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close this file?"
      );
      if (!confirmed) return;
    }
    onClose();
  };

  // Monaco editor mounting
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Register and apply dynamic theme based on app's CSS variables
    const themeName = registerMonacoTheme(monaco);
    setEditorTheme(themeName);
    monaco.editor.setTheme(themeName);

    // Add save command to editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-dark-bg)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-[var(--color-dark-fg)]">
            Loading {fileName}...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--color-dark-bg)]">
        <div className="flex flex-col items-center gap-3 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h3 className="text-lg font-semibold text-[var(--color-dark-fg)]">
            Failed to Load File
          </h3>
          <p className="text-sm text-[var(--color-dark-muted-fg)]">{error}</p>
          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
            >
              Retry
            </Button>
            <Button onClick={onClose} variant="outline" size="sm">
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-dark-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-dark-border)]">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-[var(--color-dark-fg)]">
            {fileName}
            {isDirty && <span className="ml-1 text-yellow-500">●</span>}
          </h3>
          <span className="text-xs text-[var(--color-dark-muted-fg)]">
            {sshHost.name} - {filePath}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {fileInfo && (
            <span className="text-xs text-[var(--color-dark-muted-fg)]">
              {(fileInfo.size / 1024).toFixed(2)} KB
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={!isDirty || saving}
            size="sm"
            variant="default"
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save {isDirty && "(Ctrl+S)"}
              </>
            )}
          </Button>
          <Button
            onClick={handleCloseClick}
            size="sm"
            variant="ghost"
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Close
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={getLanguage(fileName)}
          value={content}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme={editorTheme}
          options={{
            fontSize: 14,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            lineNumbers: "on",
            renderWhitespace: "selection",
            bracketPairColorization: { enabled: true },
            suggest: {
              showKeywords: true,
              showSnippets: true,
            },
            quickSuggestions: true,
            formatOnPaste: true,
            formatOnType: true,
          }}
        />
      </div>

      {/* Status bar */}
      {isDirty && (
        <div className="px-4 py-1 text-xs bg-yellow-900/20 border-t border-yellow-700/50 text-yellow-500">
          Unsaved changes - Press Ctrl+S or click Save to save your changes
        </div>
      )}
    </div>
  );
};

export default RemoteEditor;
