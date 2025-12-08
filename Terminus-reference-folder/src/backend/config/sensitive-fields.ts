/**
 * Centralized configuration for sensitive database fields that require encryption.
 *
 * This is the single source of truth for all sensitive field definitions across the application.
 * Any changes to sensitive fields should ONLY be made in this file.
 *
 * @module sensitive-fields
 */

/**
 * Defines which fields in each database table should be encrypted at rest.
 *
 * Structure:
 * - Key: Table name (e.g., "users", "ssh_data", "ssh_credentials")
 * - Value: Array of field names that contain sensitive data requiring encryption
 */
export const SENSITIVE_FIELDS_BY_TABLE: Record<string, string[]> = {
  /**
   * Users table sensitive fields:
   * - password_hash: Hashed password (bcrypt)
   * - client_secret: OAuth/OIDC client secret
   * - totp_secret: Time-based One-Time Password secret
   * - totp_backup_codes: TOTP backup recovery codes
   * - oidc_identifier: OpenID Connect user identifier
   */
  users: [
    "password_hash",
    "client_secret",
    "totp_secret",
    "totp_backup_codes",
    "oidc_identifier",
  ],

  /**
   * SSH connection data sensitive fields:
   * - password: SSH password authentication
   * - key: SSH private key content
   * - key_password: SSH private key passphrase
   */
  ssh_data: ["password", "key", "key_password"],

  /**
   * SSH credentials (reusable) sensitive fields:
   * - password: SSH password for authentication
   * - key: SSH private key content
   * - key_password: SSH private key passphrase
   * - private_key: SSH private key (alternative field name)
   * - public_key: SSH public key
   */
  ssh_credentials: [
    "password",
    "key",
    "key_password",
    "private_key",
    "public_key",
  ],
};

/**
 * Get the list of sensitive fields for a specific table.
 *
 * @param tableName - The name of the database table
 * @returns Array of field names that should be encrypted, or empty array if table not found
 */
export function getSensitiveFields(tableName: string): string[] {
  return SENSITIVE_FIELDS_BY_TABLE[tableName] || [];
}

/**
 * Check if a specific field in a table should be encrypted.
 *
 * @param tableName - The name of the database table
 * @param fieldName - The name of the field to check
 * @returns true if the field should be encrypted, false otherwise
 */
export function isSensitiveField(
  tableName: string,
  fieldName: string,
): boolean {
  const fields = SENSITIVE_FIELDS_BY_TABLE[tableName];
  return fields ? fields.includes(fieldName) : false;
}

/**
 * Get all sensitive fields across all tables (flattened list, deduplicated).
 * Useful for checking if a field name is sensitive regardless of table context.
 *
 * @returns Array of all unique sensitive field names
 */
export function getAllSensitiveFields(): string[] {
  const allFields = new Set<string>();
  for (const fields of Object.values(SENSITIVE_FIELDS_BY_TABLE)) {
    fields.forEach((field) => allFields.add(field));
  }
  return Array.from(allFields);
}

/**
 * Get a Map representation of sensitive fields for efficient lookups.
 * Each table name maps to a Set of field names.
 *
 * @returns Map of table names to Sets of sensitive field names
 */
export function getSensitiveFieldsMap(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [tableName, fields] of Object.entries(SENSITIVE_FIELDS_BY_TABLE)) {
    map.set(tableName, new Set(fields));
  }
  return map;
}

/**
 * Get table configuration with fields for re-encryption operations.
 * Used primarily for password reset operations that require re-encrypting all user data.
 *
 * @returns Array of objects containing table name and sensitive fields
 */
export function getTableConfigsForReencryption(): Array<{
  table: string;
  fields: string[];
}> {
  return Object.entries(SENSITIVE_FIELDS_BY_TABLE).map(([table, fields]) => ({
    table,
    fields,
  }));
}
