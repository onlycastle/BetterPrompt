/**
 * Shared Library Functions
 *
 * Common utilities used across the application.
 *
 * @module lib
 */

// Result type for error handling
export {
  type Result,
  type Success,
  type Failure,
  ok,
  err,
  errMsg,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  map,
  mapErr,
  flatMap,
  tryCatch,
  tryCatchAsync,
  all,
  allObject,
  any,
  fromNullable,
  fromDomainError,
  fromDomainErrorAsync,
  match,
  tap,
  mapAsync,
  flatMapAsync,
  allAsync,
} from './result.js';
