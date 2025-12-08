/**
 * Express Request type extensions for authentication middleware
 */

import type { Request } from "express";

/**
 * Augment Express Request interface to include userId from JWT authentication middleware
 * Note: userId is a string to match the database schema (text type)
 */
declare global {
  namespace Express {
    interface Request {
      /**
       * User ID extracted from JWT token by the authenticateJWT middleware
       * This is a string to match the database schema
       */
      userId?: string;
    }
  }
}

/**
 * Authenticated Request type - ensures userId is defined
 */
export interface AuthenticatedRequest extends Request {
  userId: string;
}
