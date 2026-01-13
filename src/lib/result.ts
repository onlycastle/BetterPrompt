/**
 * Result Type
 *
 * A discriminated union type for handling success/failure without exceptions.
 * Inspired by Rust's Result<T, E> type.
 *
 * @module lib/result
 */

import { DomainError } from '../domain/errors/index.js';

// ============================================================================
// Result Type Definition
// ============================================================================

/**
 * Success result
 */
export interface Success<T> {
  readonly success: true;
  readonly data: T;
}

/**
 * Failure result
 */
export interface Failure<E extends Error = Error> {
  readonly success: false;
  readonly error: E;
}

/**
 * Result type - either Success<T> or Failure<E>
 */
export type Result<T, E extends Error = Error> = Success<T> | Failure<E>;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a success result
 */
export function ok<T>(data: T): Success<T> {
  return { success: true, data };
}

/**
 * Create a failure result
 */
export function err<E extends Error>(error: E): Failure<E> {
  return { success: false, error };
}

/**
 * Create a failure result from a string message
 */
export function errMsg(message: string): Failure<Error> {
  return { success: false, error: new Error(message) };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if result is success
 */
export function isOk<T, E extends Error>(result: Result<T, E>): result is Success<T> {
  return result.success;
}

/**
 * Check if result is failure
 */
export function isErr<T, E extends Error>(result: Result<T, E>): result is Failure<E> {
  return !result.success;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Unwrap a result, throwing if it's an error
 */
export function unwrap<T, E extends Error>(result: Result<T, E>): T {
  if (result.success) return result.data;
  throw result.error;
}

/**
 * Unwrap a result with a default value
 */
export function unwrapOr<T, E extends Error>(result: Result<T, E>, defaultValue: T): T {
  if (result.success) return result.data;
  return defaultValue;
}

/**
 * Unwrap a result with a lazy default
 */
export function unwrapOrElse<T, E extends Error>(
  result: Result<T, E>,
  fn: (error: E) => T
): T {
  if (result.success) return result.data;
  return fn(result.error);
}

/**
 * Map success value
 */
export function map<T, U, E extends Error>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.success) return ok(fn(result.data));
  return result;
}

/**
 * Map error value
 */
export function mapErr<T, E extends Error, F extends Error>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (result.success) return result;
  return err(fn(result.error));
}

/**
 * Flat map (chain) success value
 */
export function flatMap<T, U, E extends Error>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.success) return fn(result.data);
  return result;
}

/**
 * Try to execute a function and return a Result
 */
export function tryCatch<T, E extends Error = Error>(fn: () => T): Result<T, E> {
  try {
    return ok(fn());
  } catch (e) {
    return err(e as E);
  }
}

/**
 * Try to execute an async function and return a Result
 */
export async function tryCatchAsync<T, E extends Error = Error>(
  fn: () => Promise<T>
): Promise<Result<T, E>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (e) {
    return err(e as E);
  }
}

/**
 * Combine multiple results into one
 * Returns first error if any, otherwise array of all values
 */
export function all<T, E extends Error>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (!result.success) return result;
    values.push(result.data);
  }

  return ok(values);
}

/**
 * Combine results from an object
 */
export function allObject<T extends Record<string, Result<unknown, Error>>>(
  results: T
): Result<{ [K in keyof T]: T[K] extends Result<infer U, Error> ? U : never }, Error> {
  const values: Record<string, unknown> = {};

  for (const [key, result] of Object.entries(results)) {
    if (!result.success) return result;
    values[key] = result.data;
  }

  return ok(values as { [K in keyof T]: T[K] extends Result<infer U, Error> ? U : never });
}

/**
 * Return first success, or last error if all fail
 */
export function any<T, E extends Error>(results: Result<T, E>[]): Result<T, E> {
  let lastError: E | undefined;

  for (const result of results) {
    if (result.success) return result;
    lastError = result.error;
  }

  if (lastError) return err(lastError);
  return err(new Error('No results provided') as E);
}

// ============================================================================
// Domain-Specific Helpers
// ============================================================================

/**
 * Create a Result from a nullable value
 */
export function fromNullable<T, E extends Error>(
  value: T | null | undefined,
  error: E
): Result<T, E> {
  if (value === null || value === undefined) return err(error);
  return ok(value);
}

/**
 * Create a Result from a DomainError-wrapped operation
 */
export function fromDomainError<T>(
  fn: () => T,
  errorWrapper: (e: Error) => DomainError
): Result<T, DomainError> {
  try {
    return ok(fn());
  } catch (e) {
    const error = e instanceof DomainError ? e : errorWrapper(e as Error);
    return err(error);
  }
}

/**
 * Async version of fromDomainError
 */
export async function fromDomainErrorAsync<T>(
  fn: () => Promise<T>,
  errorWrapper: (e: Error) => DomainError
): Promise<Result<T, DomainError>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (e) {
    const error = e instanceof DomainError ? e : errorWrapper(e as Error);
    return err(error);
  }
}

/**
 * Match pattern for Result (like Rust match)
 */
export function match<T, E extends Error, R>(
  result: Result<T, E>,
  handlers: {
    ok: (value: T) => R;
    err: (error: E) => R;
  }
): R {
  if (result.success) return handlers.ok(result.data);
  return handlers.err(result.error);
}

/**
 * Tap into result for side effects (logging, etc.)
 */
export function tap<T, E extends Error>(
  result: Result<T, E>,
  handlers: {
    ok?: (value: T) => void;
    err?: (error: E) => void;
  }
): Result<T, E> {
  if (result.success && handlers.ok) handlers.ok(result.data);
  if (!result.success && handlers.err) handlers.err(result.error);
  return result;
}

// ============================================================================
// Async Combinators
// ============================================================================

/**
 * Async map
 */
export async function mapAsync<T, U, E extends Error>(
  result: Result<T, E>,
  fn: (value: T) => Promise<U>
): Promise<Result<U, E>> {
  if (result.success) return ok(await fn(result.data));
  return result;
}

/**
 * Async flat map
 */
export async function flatMapAsync<T, U, E extends Error>(
  result: Result<T, E>,
  fn: (value: T) => Promise<Result<U, E>>
): Promise<Result<U, E>> {
  if (result.success) return await fn(result.data);
  return result;
}

/**
 * Combine multiple async results
 */
export async function allAsync<T, E extends Error>(
  results: Promise<Result<T, E>>[]
): Promise<Result<T[], E>> {
  const settled = await Promise.all(results);
  return all(settled);
}
