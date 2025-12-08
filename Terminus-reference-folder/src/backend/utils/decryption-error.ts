/**
 * Custom error codes for decryption failures
 */
export enum DecryptionErrorCode {
  /** Field data is corrupted and cannot be parsed */
  CORRUPTED_DATA = "CORRUPTED_DATA",
  /** Decryption failed with current key (may indicate wrong key or corrupted data) */
  DECRYPTION_FAILED = "DECRYPTION_FAILED",
  /** Decryption failed with both current and legacy field names */
  LEGACY_DECRYPTION_FAILED = "LEGACY_DECRYPTION_FAILED",
  /** Field is marked as sensitive but decryption failed */
  SENSITIVE_FIELD_DECRYPTION_FAILED = "SENSITIVE_FIELD_DECRYPTION_FAILED",
  /** User's data key is not available or invalid */
  INVALID_USER_KEY = "INVALID_USER_KEY",
  /** Authentication tag verification failed */
  AUTH_TAG_VERIFICATION_FAILED = "AUTH_TAG_VERIFICATION_FAILED",
}

/**
 * Custom error class for decryption failures
 * Provides structured error information for better debugging and error handling
 */
export class DecryptionError extends Error {
  public readonly code: DecryptionErrorCode;
  public readonly fieldName: string;
  public readonly recordId: string;
  public readonly tableName?: string;
  public readonly originalError?: Error;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: DecryptionErrorCode,
    fieldName: string,
    recordId: string,
    tableName?: string,
    originalError?: Error,
  ) {
    super(message);
    this.name = "DecryptionError";
    this.code = code;
    this.fieldName = fieldName;
    this.recordId = recordId;
    this.tableName = tableName;
    this.originalError = originalError;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DecryptionError);
    }
  }

  /**
   * Returns a user-friendly error message
   */
  public getUserMessage(): string {
    switch (this.code) {
      case DecryptionErrorCode.CORRUPTED_DATA:
        return `The data for ${this.fieldName} appears to be corrupted and cannot be read.`;
      case DecryptionErrorCode.DECRYPTION_FAILED:
        return `Failed to decrypt ${this.fieldName}. Your data may have been encrypted with a different password.`;
      case DecryptionErrorCode.LEGACY_DECRYPTION_FAILED:
        return `Failed to decrypt ${this.fieldName} using both current and legacy encryption formats.`;
      case DecryptionErrorCode.SENSITIVE_FIELD_DECRYPTION_FAILED:
        return `Failed to decrypt sensitive field ${this.fieldName}. The data may be corrupted or encrypted with a different key.`;
      case DecryptionErrorCode.INVALID_USER_KEY:
        return `Your encryption key is not available. Please log in again.`;
      case DecryptionErrorCode.AUTH_TAG_VERIFICATION_FAILED:
        return `Data integrity check failed for ${this.fieldName}. The data may have been tampered with or is corrupted.`;
      default:
        return `Failed to decrypt ${this.fieldName}: ${this.message}`;
    }
  }

  /**
   * Returns a detailed technical error message for logging
   */
  public getTechnicalMessage(): string {
    const parts = [
      `[${this.code}]`,
      `Field: ${this.fieldName}`,
      `Record: ${this.recordId}`,
    ];

    if (this.tableName) {
      parts.push(`Table: ${this.tableName}`);
    }

    if (this.originalError) {
      parts.push(`Original Error: ${this.originalError.message}`);
    }

    parts.push(`Message: ${this.message}`);

    return parts.join(" | ");
  }

  /**
   * Converts the error to a JSON-serializable object
   */
  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      fieldName: this.fieldName,
      recordId: this.recordId,
      tableName: this.tableName,
      timestamp: this.timestamp.toISOString(),
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
          }
        : undefined,
    };
  }
}

/**
 * Type guard to check if an error is a DecryptionError
 */
export function isDecryptionError(error: unknown): error is DecryptionError {
  return error instanceof DecryptionError;
}

/**
 * Helper function to create a DecryptionError from a generic error
 */
export function createDecryptionError(
  error: unknown,
  code: DecryptionErrorCode,
  fieldName: string,
  recordId: string,
  tableName?: string,
): DecryptionError {
  const message =
    error instanceof Error ? error.message : "Unknown decryption error";
  const originalError = error instanceof Error ? error : undefined;

  return new DecryptionError(
    message,
    code,
    fieldName,
    recordId,
    tableName,
    originalError,
  );
}
