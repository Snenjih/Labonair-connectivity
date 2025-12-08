/**
 * Centralized authentication utilities
 * Handles token management, validation, and automatic logout
 */

import { toast } from "sonner";

/**
 * Check if JWT token exists in localStorage
 */
export function hasAuthToken(): boolean {
  const token = localStorage.getItem("jwt");
  return !!token;
}

/**
 * Get JWT token from localStorage
 */
export function getAuthToken(): string | null {
  return localStorage.getItem("jwt");
}

/**
 * Set JWT token in localStorage
 */
export function setAuthToken(token: string): void {
  localStorage.setItem("jwt", token);
  console.log("[AUTH] Token stored in localStorage");
}

/**
 * Remove JWT token and cookie, forcing logout
 */
export function clearAuthToken(): void {
  // Remove from localStorage
  localStorage.removeItem("jwt");

  // Clear cookie
  document.cookie = "jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

  console.log("[AUTH] All auth tokens cleared");
}

// Flag to prevent infinite reload loops
let isLoggingOut = false;

/**
 * Force logout: Clear all auth data and redirect to login
 * @param reason - Reason for logout (for logging/toast)
 * @param showToast - Whether to show a toast notification
 */
export function forceLogout(reason: string = "Session expired", showToast: boolean = true): void {
  // Prevent infinite logout loops
  if (isLoggingOut) {
    console.warn("[AUTH] Already logging out, skipping...");
    return;
  }

  // Check if there's a token BEFORE clearing it
  const hadToken = !!localStorage.getItem("jwt");

  isLoggingOut = true;
  console.warn(`[AUTH] Force logout: ${reason} (had token: ${hadToken})`);

  // Clear all auth data
  clearAuthToken();

  // Show toast notification (only if we had a token, meaning user was logged in)
  if (showToast && hadToken) {
    toast.error("Session Expired", {
      description: reason,
      duration: 5000,
    });
  }

  // Only reload if we had a token (means user was logged in)
  if (hadToken) {
    console.log("[AUTH] Reloading to show login screen...");
    setTimeout(() => {
      window.location.reload();
    }, 500);
  } else {
    // No token means we're already logged out, just reset the flag
    console.log("[AUTH] Already logged out, no reload needed");
    isLoggingOut = false;
  }
}

/**
 * Validate token format (basic check)
 * @returns true if token looks valid, false otherwise
 */
export function isValidTokenFormat(token: string | null): boolean {
  if (!token) return false;

  // JWT tokens have 3 parts separated by dots
  const parts = token.split(".");
  if (parts.length !== 3) {
    console.warn("[AUTH] Invalid token format: not a JWT");
    return false;
  }

  // Each part should be base64-encoded
  try {
    atob(parts[0]);
    atob(parts[1]);
    return true;
  } catch (e) {
    console.warn("[AUTH] Invalid token format: not base64");
    return false;
  }
}

/**
 * Check if token is expired (basic check by parsing JWT)
 * Note: This is client-side check only, server will do the real validation
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token || !isValidTokenFormat(token)) return true;

  try {
    const parts = token.split(".");
    const payload = JSON.parse(atob(parts[1]));

    if (!payload.exp) {
      // No expiration claim - assume valid
      return false;
    }

    // Check if expired (exp is in seconds, Date.now() is in milliseconds)
    const now = Date.now() / 1000;
    const expired = payload.exp < now;

    if (expired) {
      console.warn("[AUTH] Token is expired");
    }

    return expired;
  } catch (e) {
    console.error("[AUTH] Error parsing token:", e);
    return true;
  }
}

/**
 * Validate current auth state
 * @returns true if user is authenticated, false otherwise
 */
export function validateAuthState(): boolean {
  const token = getAuthToken();

  if (!token) {
    console.warn("[AUTH] No token found");
    return false;
  }

  if (!isValidTokenFormat(token)) {
    console.warn("[AUTH] Invalid token format");
    return false;
  }

  if (isTokenExpired(token)) {
    console.warn("[AUTH] Token is expired");
    return false;
  }

  return true;
}

/**
 * Handle authentication error
 * Shows appropriate toast and forces logout if needed
 */
export function handleAuthError(error: any, operation: string): void {
  const status = error?.response?.status;
  const message = error?.response?.data?.error || error?.message || "Authentication error";

  console.error(`[AUTH ERROR] ${operation}:`, error);

  if (status === 401) {
    // Unauthorized - force logout
    forceLogout("Your session has expired. Please log in again.", true);
  } else if (status === 403) {
    // Forbidden
    toast.error("Access Denied", {
      description: "You don't have permission to perform this action.",
      duration: 5000,
    });
  } else {
    // Other errors
    toast.error("Authentication Error", {
      description: message,
      duration: 5000,
    });
  }
}
