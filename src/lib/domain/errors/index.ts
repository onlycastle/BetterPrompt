/**
 * Domain Errors
 *
 * Unified error types for the entire application.
 * All errors extend DomainError for consistent handling.
 *
 * @module domain/errors
 */

// ============================================================================
// Base Domain Error
// ============================================================================

/**
 * Base class for all domain errors
 * Provides consistent structure for error handling
 */
export abstract class DomainError extends Error {
  /** Unique error code for programmatic handling */
  abstract readonly code: string;

  /** Whether this error can be retried */
  abstract readonly retryable: boolean;

  /** User-friendly message (safe to display) */
  abstract readonly userMessage: string;

  /** HTTP status code (for API responses) */
  readonly statusCode: number;

  /** Original error (if wrapping another error) */
  readonly cause?: Error;

  constructor(message: string, statusCode = 500, cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.cause = cause;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Convert to JSON for logging/API responses
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      statusCode: this.statusCode,
      retryable: this.retryable,
    };
  }
}

// ============================================================================
// Analysis Errors
// ============================================================================

/**
 * Errors related to session analysis
 */
export class AnalysisError extends DomainError {
  readonly code: string;
  readonly retryable: boolean;
  readonly userMessage: string;

  constructor(
    code: string,
    message: string,
    userMessage: string,
    retryable = false,
    statusCode = 500,
    cause?: Error
  ) {
    super(message, statusCode, cause);
    this.code = code;
    this.retryable = retryable;
    this.userMessage = userMessage;
  }

  // Factory methods for common analysis errors
  static sessionNotFound(sessionId: string) {
    return new AnalysisError(
      'ANALYSIS_SESSION_NOT_FOUND',
      `Session not found: ${sessionId}`,
      'The requested session could not be found.',
      false,
      404
    );
  }

  static parseError(filePath: string, cause?: Error) {
    return new AnalysisError(
      'ANALYSIS_PARSE_ERROR',
      `Failed to parse session file: ${filePath}`,
      'Unable to read the session file. It may be corrupted.',
      false,
      400,
      cause
    );
  }

  static llmError(message: string, retryable = true, cause?: Error) {
    return new AnalysisError(
      'ANALYSIS_LLM_ERROR',
      `LLM analysis failed: ${message}`,
      'The AI analysis service is temporarily unavailable. Please try again.',
      retryable,
      503,
      cause
    );
  }

  static rateLimited(retryAfterMs?: number) {
    const retryAfter = retryAfterMs ? ` Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.` : '';
    return new AnalysisError(
      'ANALYSIS_RATE_LIMITED',
      'API rate limit exceeded',
      `Too many requests.${retryAfter}`,
      true,
      429
    );
  }

  static quotaExceeded(remaining: number, resetAt: Date) {
    return new AnalysisError(
      'ANALYSIS_QUOTA_EXCEEDED',
      'Monthly analysis quota exceeded',
      `You've used all ${remaining} analyses this month. Upgrade or wait until ${resetAt.toLocaleDateString()}.`,
      false,
      402
    );
  }

  static invalidSession(reason: string) {
    return new AnalysisError(
      'ANALYSIS_INVALID_SESSION',
      `Invalid session: ${reason}`,
      'This session cannot be analyzed. It may be too short or malformed.',
      false,
      400
    );
  }
}

// ============================================================================
// Storage Errors
// ============================================================================

/**
 * Errors related to data storage (SQLite, local files)
 */
export class StorageError extends DomainError {
  readonly code: string;
  readonly retryable: boolean;
  readonly userMessage: string;

  constructor(
    code: string,
    message: string,
    userMessage: string,
    retryable = false,
    statusCode = 500,
    cause?: Error
  ) {
    super(message, statusCode, cause);
    this.code = code;
    this.retryable = retryable;
    this.userMessage = userMessage;
  }

  // Factory methods for common storage errors
  static connectionFailed(service: string, reason?: string | Error) {
    const cause = reason instanceof Error ? reason : undefined;
    const message = reason instanceof Error ? reason.message : reason;
    return new StorageError(
      'STORAGE_CONNECTION_FAILED',
      `Failed to connect to ${service}${message ? `: ${message}` : ''}`,
      'Unable to connect to the database. Please check your connection.',
      true,
      503,
      cause
    );
  }

  static notFound(resource: string, id: string) {
    return new StorageError(
      'STORAGE_NOT_FOUND',
      `${resource} not found: ${id}`,
      `The requested ${resource.toLowerCase()} could not be found.`,
      false,
      404
    );
  }

  static duplicateKey(resource: string, field: string, value?: string) {
    const message = value
      ? `Duplicate ${resource}.${field}: ${value}`
      : `Duplicate ${resource}: ${field}`;
    const userMessage = value
      ? `A ${resource.toLowerCase()} with this ${field} already exists.`
      : `A ${resource.toLowerCase()} with this identifier already exists.`;
    return new StorageError(
      'STORAGE_DUPLICATE_KEY',
      message,
      userMessage,
      false,
      409
    );
  }

  static writeError(resource: string, cause?: Error) {
    return new StorageError(
      'STORAGE_WRITE_ERROR',
      `Failed to write ${resource}`,
      'Unable to save your data. Please try again.',
      true,
      500,
      cause
    );
  }

  static readError(resource: string, cause?: Error) {
    return new StorageError(
      'STORAGE_READ_ERROR',
      `Failed to read ${resource}`,
      'Unable to load your data. Please try again.',
      true,
      500,
      cause
    );
  }

  static syncFailed(direction: 'push' | 'pull', cause?: Error) {
    return new StorageError(
      'STORAGE_SYNC_FAILED',
      `Sync ${direction} failed`,
      `Unable to sync data with the cloud. Your data is safe locally.`,
      true,
      503,
      cause
    );
  }

  static writeFailed(resource: string, id: string, reason?: string) {
    return new StorageError(
      'STORAGE_WRITE_FAILED',
      `Failed to write ${resource}: ${id}${reason ? ` - ${reason}` : ''}`,
      'Unable to save your data. Please try again.',
      true,
      500
    );
  }

  static readFailed(resource: string, id: string, reason?: string) {
    return new StorageError(
      'STORAGE_READ_FAILED',
      `Failed to read ${resource}: ${id}${reason ? ` - ${reason}` : ''}`,
      'Unable to load your data. Please try again.',
      true,
      500
    );
  }

  static deleteFailed(resource: string, id: string, reason?: string) {
    return new StorageError(
      'STORAGE_DELETE_FAILED',
      `Failed to delete ${resource}: ${id}${reason ? ` - ${reason}` : ''}`,
      'Unable to delete the data. Please try again.',
      true,
      500
    );
  }

  static queryFailed(reason: string) {
    return new StorageError(
      'STORAGE_QUERY_FAILED',
      `Query failed: ${reason}`,
      'Unable to retrieve data. Please try again.',
      true,
      500
    );
  }
}

// ============================================================================
// Skill Errors
// ============================================================================

/**
 * Errors from Search Agent skills (Gatherer, Judge, Organizer, etc.)
 */
export class SkillError extends DomainError {
  readonly code: string;
  readonly retryable: boolean;
  readonly userMessage: string;
  readonly skillName: string;

  constructor(
    skillName: string,
    code: string,
    message: string,
    userMessage: string,
    retryable = false,
    statusCode = 500,
    cause?: Error
  ) {
    super(message, statusCode, cause);
    this.skillName = skillName;
    this.code = code;
    this.retryable = retryable;
    this.userMessage = userMessage;
  }

  // Factory methods for common skill errors
  static executionFailed(skillName: string, reason: string, cause?: Error) {
    return new SkillError(
      skillName,
      'SKILL_EXECUTION_FAILED',
      `${skillName} execution failed: ${reason}`,
      `The ${skillName.toLowerCase()} skill encountered an error. Please try again.`,
      true,
      500,
      cause
    );
  }

  static invalidInput(skillName: string, field: string, reason: string) {
    return new SkillError(
      skillName,
      'SKILL_INVALID_INPUT',
      `${skillName} invalid input: ${field} - ${reason}`,
      `Invalid input provided to ${skillName.toLowerCase()}.`,
      false,
      400
    );
  }

  static dependencyMissing(skillName: string, dependency: string) {
    return new SkillError(
      skillName,
      'SKILL_DEPENDENCY_MISSING',
      `${skillName} missing dependency: ${dependency}`,
      `The ${skillName.toLowerCase()} skill requires ${dependency} to be available.`,
      false,
      503
    );
  }

  static llmRequired(skillName: string) {
    return new SkillError(
      skillName,
      'SKILL_LLM_REQUIRED',
      `${skillName} requires LLM client`,
      'This feature requires an API key. Please configure your API key.',
      false,
      401
    );
  }
}

// ============================================================================
// Authentication Errors
// ============================================================================

/**
 * Errors related to authentication and authorization
 */
export class AuthError extends DomainError {
  readonly code: string;
  readonly retryable: boolean;
  readonly userMessage: string;

  constructor(
    code: string,
    message: string,
    userMessage: string,
    statusCode = 401,
    cause?: Error
  ) {
    super(message, statusCode, cause);
    this.code = code;
    this.retryable = false; // Auth errors are generally not retryable
    this.userMessage = userMessage;
  }

  // Factory methods
  static unauthorized() {
    return new AuthError(
      'AUTH_UNAUTHORIZED',
      'User is not authenticated',
      'Please sign in to continue.'
    );
  }

  static forbidden(resource: string) {
    return new AuthError(
      'AUTH_FORBIDDEN',
      `Access denied to ${resource}`,
      'You do not have permission to access this resource.',
      403
    );
  }

  static tierRequired(requiredTier: string) {
    return new AuthError(
      'AUTH_TIER_REQUIRED',
      `${requiredTier} tier required`,
      `This feature requires the ${requiredTier} plan. Please upgrade to access.`,
      402
    );
  }

  static invalidToken() {
    return new AuthError(
      'AUTH_INVALID_TOKEN',
      'Invalid authentication token',
      'Your session has expired. Please sign in again.'
    );
  }

  static licenseInvalid(reason: string) {
    return new AuthError(
      'AUTH_LICENSE_INVALID',
      `Invalid license: ${reason}`,
      'Your license key is invalid or has expired.',
      402
    );
  }
}

// ============================================================================
// Job Errors
// ============================================================================

/**
 * Errors related to async job processing
 */
export class JobError extends DomainError {
  readonly code: string;
  readonly retryable: boolean;
  readonly userMessage: string;
  readonly jobId?: string;

  constructor(
    code: string,
    message: string,
    userMessage: string,
    retryable = false,
    statusCode = 500,
    jobId?: string,
    cause?: Error
  ) {
    super(message, statusCode, cause);
    this.code = code;
    this.retryable = retryable;
    this.userMessage = userMessage;
    this.jobId = jobId;
  }

  // Factory methods
  static notFound(jobId: string) {
    return new JobError(
      'JOB_NOT_FOUND',
      `Job not found: ${jobId}`,
      'The requested job could not be found.',
      false,
      404,
      jobId
    );
  }

  static alreadyCompleted(jobId: string) {
    return new JobError(
      'JOB_ALREADY_COMPLETED',
      `Job already completed: ${jobId}`,
      'This job has already finished.',
      false,
      409,
      jobId
    );
  }

  static maxRetriesExceeded(jobId: string) {
    return new JobError(
      'JOB_MAX_RETRIES',
      `Job exceeded max retries: ${jobId}`,
      'The job failed after multiple attempts.',
      false,
      500,
      jobId
    );
  }

  static processingFailed(jobId: string, reason: string, cause?: Error) {
    return new JobError(
      'JOB_PROCESSING_FAILED',
      `Job processing failed: ${reason}`,
      'The job encountered an error during processing.',
      true,
      500,
      jobId,
      cause
    );
  }

  static timeout(jobId: string, timeoutMs: number) {
    return new JobError(
      'JOB_TIMEOUT',
      `Job timed out after ${timeoutMs}ms: ${jobId}`,
      'The job took too long to complete.',
      true,
      504,
      jobId
    );
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

/**
 * Errors related to input validation
 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly retryable = false;
  readonly userMessage: string;
  readonly fields: Record<string, string[]>;

  constructor(
    message: string,
    userMessage: string,
    fields: Record<string, string[]> = {}
  ) {
    super(message, 400);
    this.userMessage = userMessage;
    this.fields = fields;
  }

  static fromZod(zodError: { issues: Array<{ path: (string | number)[]; message: string }> }) {
    const fields: Record<string, string[]> = {};

    for (const error of zodError.issues) {
      const path = error.path.join('.');
      if (!fields[path]) fields[path] = [];
      fields[path].push(error.message);
    }

    return new ValidationError(
      'Validation failed',
      'Please check your input and try again.',
      fields
    );
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      fields: this.fields,
    };
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if error is a domain error
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (isDomainError(error)) return error.retryable;
  return false;
}

/**
 * Wrap unknown error in a domain error
 */
export function wrapError(error: unknown, context = 'Operation'): DomainError {
  if (isDomainError(error)) return error;

  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  return new StorageError(
    'UNKNOWN_ERROR',
    `${context} failed: ${message}`,
    'An unexpected error occurred. Please try again.',
    false,
    500,
    cause
  );
}

// Re-export all error types
export {
  DomainError as BaseError,
};
