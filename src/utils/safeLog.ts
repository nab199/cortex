/**
 * Security Utilities - Safe Logging Functions
 * 
 * This module provides utilities for safely logging data without exposing
 * sensitive information like JWTs, API keys, passwords, or Authorization headers.
 */

// Keys that should never be logged
const SECRET_KEYS = [
  'password',
  'password_hash',
  'pwd',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'jwt',
  'jwt_token',
  'authorization',
  'auth_token',
  'api_key',
  'apikey',
  'api_key',
  'chapa_key',
  'chapa_api_key',
  'afro_api_key',
  'afro_message_api_key',
  'gemini_api_key',
  'private_key',
  'public_key',
  'credentials',
  'cookie',
  'cookies',
  'session',
  'session_id',
  'x-api-key',
  'bearer',
  'authorization',
  'accessKey',
  'secretKey',
  'stripe',
  'paystack',
  'twilio',
];

// Headers that contain sensitive data
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
  'x-xsrf-token',
];

/**
 * Redacts sensitive keys from an object, replacing their values with [REDACTED]
 * Preserves the key name for debugging but hides the value
 */
export function redactSecrets(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const redacted: Record<string, any> = { ...obj };

  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    
    // Check if this key is a secret
    if (SECRET_KEYS.some(secret => lowerKey.includes(secret.toLowerCase()))) {
      const value = redacted[key];
      
      // If it's a string, redact it
      if (typeof value === 'string') {
        // Show first 4 chars if it's a token-like value for debugging
        if (value.length > 8 && !value.includes(' ')) {
          redacted[key] = `${value.substring(0, 4)}...[REDACTED]`;
        } else {
          redacted[key] = '[REDACTED]';
        }
      } else if (typeof value === 'object') {
        // Recursively redact nested objects
        redacted[key] = '[OBJECT REDACTED]';
      } else {
        redacted[key] = '[REDACTED]';
      }
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      // Recursively process nested objects
      redacted[key] = redactSecrets(redacted[key]);
    }
  }

  return redacted;
}

/**
 * Redacts sensitive headers from request/response headers
 */
export function redactHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const redacted: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (value) {
      redacted[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
  }
  
  return redacted;
}

/**
 * Safe error formatter for logging
 * Removes sensitive data from error objects while preserving useful debug info
 */
export function formatErrorForLogging(error: any): any {
  if (!error) return error;

  // Create a safe copy without sensitive data
  const safeError: any = {
    message: error.message || 'Unknown error',
    name: error.name,
    status: error.status || error.statusCode,
  };

  // Include stack trace in development only
  if (process.env.NODE_ENV !== 'production' && error.stack) {
    safeError.stack = error.stack;
  }

  // If there's response data, redact it
  if (error.response?.data) {
    safeError.response = {
      status: error.response.status,
      statusText: error.response.statusText,
      data: redactSecrets(error.response.data),
    };
  }

  // Redact any other sensitive properties
  const sensitiveProps = ['config', 'headers', 'request'];
  for (const prop of sensitiveProps) {
    if (error[prop]) {
      if (prop === 'config') {
        safeError.config = {
          url: error.config?.url,
          method: error.config?.method,
          // Redact auth headers from config
          headers: error.config?.headers ? redactHeaders(error.config.headers) : undefined,
        };
      } else if (prop === 'headers') {
        safeError.headers = redactHeaders(error.headers);
      }
    }
  }

  return safeError;
}

/**
 * Logs a message safely, redacting any secrets in the data
 */
export function safeLog(level: 'info' | 'error' | 'warn', message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  
  if (data === undefined) {
    console[level](prefix);
    return;
  }

  // If data is an error object, format it safely
  if (data instanceof Error) {
    console[level](prefix, formatErrorForLogging(data));
    return;
  }

  // Otherwise, redact secrets from the data
  const safeData = typeof data === 'object' ? redactSecrets(data) : data;
  console[level](prefix, safeData);
}

/**
 * Check if a string looks like a JWT token
 */
export function isJwtToken(value: string): boolean {
  return value && value.split('.').length === 3 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

/**
 * Redact a JWT token, showing only the first few characters
 */
export function redactJwt(token: string): string {
  if (!token || typeof token !== 'string') return token;
  
  if (isJwtToken(token)) {
    return `${token.substring(0, 10)}...[REDACTED]`;
  }
  
  return token;
}

/**
 * Creates a safe log message for HTTP requests
 * Useful for request/response logging middleware
 */
export interface RequestLogOptions {
  method: string;
  url: string;
  statusCode?: number;
  duration?: number;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
  userId?: number;
  ip?: string;
}

export function formatRequestLog(options: RequestLogOptions): string {
  const parts: string[] = [];
  
  parts.push(`${options.method} ${options.url}`);
  
  if (options.statusCode) {
    parts.push(`Status: ${options.statusCode}`);
  }
  
  if (options.duration !== undefined) {
    parts.push(`Duration: ${options.duration}ms`);
  }
  
  if (options.userId) {
    parts.push(`UserID: ${options.userId}`);
  }
  
  if (options.ip) {
    parts.push(`IP: ${options.ip}`);
  }

  // Log that we have headers but don't include them (to avoid logging auth)
  if (options.headers) {
    const hasAuth = Object.keys(options.headers).some(h => 
      SENSITIVE_HEADERS.includes(h.toLowerCase())
    );
    if (hasAuth) {
      parts.push('Auth: [PRESENT]');
    }
  }

  return parts.join(' | ');
}
