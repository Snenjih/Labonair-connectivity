import React from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FileItem } from "../../../../types/index.js";

interface FilePropertiesModalProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "-";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  const formattedSize = unitIndex === 0 ? size.toString() : size.toFixed(2);
  return `${formattedSize} ${units[unitIndex]}`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return dateString;
  }
}

export function FilePropertiesModal({
  file,
  isOpen,
  onClose,
}: FilePropertiesModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !file) return null;

  const propertyRows = [
    { label: t("fileManager.name"), value: file.name },
    { label: t("fileManager.path"), value: file.path },
    {
      label: t("fileManager.type"),
      value: file.type === "directory" ? t("fileManager.folder") : file.type === "link" ? t("fileManager.symlink") : t("fileManager.file"),
    },
    { label: t("fileManager.size"), value: file.type === "file" ? formatFileSize(file.size) : "-" },
    { label: t("fileManager.modified"), value: formatDate(file.modified) },
    { label: t("fileManager.permissions"), value: file.permissions || "-" },
    { label: t("fileManager.owner"), value: file.owner || "-" },
    { label: t("fileManager.group"), value: file.group || "-" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-dark-bg border border-dark-border rounded-lg shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold text-white">
            {t("fileManager.properties")}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-dark-hover text-muted-foreground hover:text-white"
            title={t("common.close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Properties List */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {propertyRows.map((row, index) => (
            <div key={index} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground uppercase">
                {row.label}
              </span>
              <span className="text-sm text-white break-all">
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-dark-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-dark-hover hover:bg-dark-border rounded"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
