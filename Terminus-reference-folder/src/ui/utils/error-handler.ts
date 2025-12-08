import { AxiosError } from "axios";
import { toast } from "sonner";
import i18n from "i18next";

export interface ApiErrorResponse {
  error?: string;
  code?: string;
  message?: string;
  details?: any;
}

export function getErrorMessage(error: unknown): string {
  if (!error) {
    return i18n.t("errors.unknownError");
  }

  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse;

    const errorCode = data?.code || error.code;

    if (errorCode && i18n.exists(`errors.${errorCode}`)) {
      return i18n.t(`errors.${errorCode}`);
    }

    const errorMessage = data?.error || data?.message;
    if (errorMessage) {
      return errorMessage;
    }

    if (error.code === "ERR_NETWORK") {
      return i18n.t("errors.ERR_NETWORK");
    }

    if (error.code === "ECONNABORTED") {
      return i18n.t("errors.ERR_TIMEOUT");
    }

    const status = error.response?.status;
    switch (status) {
      case 401:
        return i18n.t("errors.ERR_AUTH_FAILED");
      case 403:
        return i18n.t("errors.ERR_PERMISSION_DENIED");
      case 404:
        return i18n.t("errors.ERR_NOT_FOUND");
      case 429:
        return i18n.t("errors.ERR_RATE_LIMIT");
      case 500:
        return i18n.t("errors.ERR_SERVER_ERROR");
      case 503:
        return i18n.t("errors.ERR_SERVICE_UNAVAILABLE");
      default:
        return i18n.t("errors.ERR_UNKNOWN");
    }
  }

  if (error instanceof Error) {
    return error.message || i18n.t("errors.unknownError");
  }

  if (typeof error === "string") {
    return error;
  }

  return i18n.t("errors.unknownError");
}

export function showErrorToast(
  error: unknown,
  fallbackMessage?: string
): void {
  const message = getErrorMessage(error);

  toast.error(fallbackMessage || message);
}

export function showSuccessToast(message: string): void {
  toast.success(message);
}

export function getHttpErrorCode(error: unknown): string | undefined {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse;
    return data?.code || error.code;
  }
  return undefined;
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return (
      error.code === "ERR_NETWORK" ||
      error.code === "ECONNABORTED" ||
      !error.response
    );
  }
  return false;
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return error.response?.status === 401;
  }
  return false;
}

export function isPermissionError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    return error.response?.status === 403;
  }
  return false;
}
