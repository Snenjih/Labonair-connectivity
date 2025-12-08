import React from "react";

export function ThemeCardSkeleton() {
  return (
    <div className="rounded-lg border-2 border-[var(--color-dark-border)] bg-[var(--color-sidebar-bg)] p-4 space-y-3 animate-pulse">
      {/* Theme Name Skeleton */}
      <div className="h-6 bg-[var(--color-dark-border)] rounded w-3/4"></div>

      {/* Color Swatches Skeleton */}
      <div className="flex gap-1.5">
        {[...Array(8)].map((_, index) => (
          <div
            key={index}
            className="w-10 h-10 rounded border-2 border-[var(--color-dark-border)] bg-[var(--color-dark-bg)]"
          />
        ))}
      </div>

      {/* Metadata Skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-3 bg-[var(--color-dark-border)] rounded w-16"></div>
        <div className="h-3 bg-[var(--color-dark-border)] rounded w-20"></div>
      </div>
    </div>
  );
}
