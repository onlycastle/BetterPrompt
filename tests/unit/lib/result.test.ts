import { describe, it, expect } from 'vitest';
import {
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
  match,
  tap,
  mapAsync,
  flatMapAsync,
  allAsync,
} from '../../../src/lib/result.js';

describe('Result Type', () => {
  describe('Factory Functions', () => {
    describe('ok', () => {
      it('should create a success result', () => {
        const result = ok(42);
        expect(result.success).toBe(true);
        expect(result.data).toBe(42);
      });

      it('should work with complex types', () => {
        const result = ok({ name: 'test', value: [1, 2, 3] });
        expect(result.success).toBe(true);
        expect(result.data.name).toBe('test');
      });
    });

    describe('err', () => {
      it('should create a failure result', () => {
        const error = new Error('test error');
        const result = err(error);
        expect(result.success).toBe(false);
        expect(result.error).toBe(error);
      });
    });

    describe('errMsg', () => {
      it('should create a failure result from string', () => {
        const result = errMsg('something went wrong');
        expect(result.success).toBe(false);
        expect(result.error.message).toBe('something went wrong');
      });
    });
  });

  describe('Type Guards', () => {
    describe('isOk', () => {
      it('should return true for success results', () => {
        const result = ok(42);
        expect(isOk(result)).toBe(true);
      });

      it('should return false for failure results', () => {
        const result = err(new Error('test'));
        expect(isOk(result)).toBe(false);
      });
    });

    describe('isErr', () => {
      it('should return true for failure results', () => {
        const result = err(new Error('test'));
        expect(isErr(result)).toBe(true);
      });

      it('should return false for success results', () => {
        const result = ok(42);
        expect(isErr(result)).toBe(false);
      });
    });
  });

  describe('Unwrap Functions', () => {
    describe('unwrap', () => {
      it('should return value for success', () => {
        const result = ok(42);
        expect(unwrap(result)).toBe(42);
      });

      it('should throw for failure', () => {
        const result = err(new Error('test error'));
        expect(() => unwrap(result)).toThrow('test error');
      });
    });

    describe('unwrapOr', () => {
      it('should return value for success', () => {
        const result = ok(42);
        expect(unwrapOr(result, 0)).toBe(42);
      });

      it('should return default for failure', () => {
        const result = err(new Error('test'));
        expect(unwrapOr(result, 0)).toBe(0);
      });
    });

    describe('unwrapOrElse', () => {
      it('should return value for success', () => {
        const result = ok(42);
        expect(unwrapOrElse(result, () => 0)).toBe(42);
      });

      it('should call function for failure', () => {
        const result = err(new Error('custom error'));
        const value = unwrapOrElse(result, (e) => e.message.length);
        expect(value).toBe(12); // 'custom error'.length
      });
    });
  });

  describe('Map Functions', () => {
    describe('map', () => {
      it('should transform success value', () => {
        const result = ok(5);
        const mapped = map(result, (x) => x * 2);
        expect(mapped.success).toBe(true);
        if (mapped.success) {
          expect(mapped.data).toBe(10);
        }
      });

      it('should preserve failure', () => {
        const error = new Error('test');
        const result = err(error);
        const mapped = map(result, (x: number) => x * 2);
        expect(mapped.success).toBe(false);
        if (!mapped.success) {
          expect(mapped.error).toBe(error);
        }
      });
    });

    describe('mapErr', () => {
      it('should preserve success', () => {
        const result = ok(42);
        const mapped = mapErr(result, (e) => new Error(`wrapped: ${e.message}`));
        expect(mapped.success).toBe(true);
      });

      it('should transform error', () => {
        const result = err(new Error('original'));
        const mapped = mapErr(result, (e) => new Error(`wrapped: ${e.message}`));
        expect(mapped.success).toBe(false);
        if (!mapped.success) {
          expect(mapped.error.message).toBe('wrapped: original');
        }
      });
    });

    describe('flatMap', () => {
      it('should chain successful operations', () => {
        const result = ok(5);
        const chained = flatMap(result, (x) => ok(x * 2));
        expect(chained.success).toBe(true);
        if (chained.success) {
          expect(chained.data).toBe(10);
        }
      });

      it('should short-circuit on first failure', () => {
        const result = ok(5);
        const chained = flatMap(result, () => err(new Error('failed')));
        expect(chained.success).toBe(false);
      });

      it('should not execute function on initial failure', () => {
        const result = err(new Error('initial'));
        let called = false;
        flatMap(result, () => {
          called = true;
          return ok(42);
        });
        expect(called).toBe(false);
      });
    });
  });

  describe('Try/Catch', () => {
    describe('tryCatch', () => {
      it('should return success for non-throwing function', () => {
        const result = tryCatch(() => 42);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(42);
        }
      });

      it('should return failure for throwing function', () => {
        const result = tryCatch(() => {
          throw new Error('failed');
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('failed');
        }
      });
    });

    describe('tryCatchAsync', () => {
      it('should return success for resolved promise', async () => {
        const result = await tryCatchAsync(async () => 42);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(42);
        }
      });

      it('should return failure for rejected promise', async () => {
        const result = await tryCatchAsync(async () => {
          throw new Error('async failed');
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('async failed');
        }
      });
    });
  });

  describe('Combinators', () => {
    describe('all', () => {
      it('should combine all success results', () => {
        const results = [ok(1), ok(2), ok(3)];
        const combined = all(results);
        expect(combined.success).toBe(true);
        if (combined.success) {
          expect(combined.data).toEqual([1, 2, 3]);
        }
      });

      it('should return first failure', () => {
        const error = new Error('second failed');
        const results = [ok(1), err(error), ok(3)];
        const combined = all(results);
        expect(combined.success).toBe(false);
        if (!combined.success) {
          expect(combined.error).toBe(error);
        }
      });

      it('should return empty array for empty input', () => {
        const combined = all([]);
        expect(combined.success).toBe(true);
        if (combined.success) {
          expect(combined.data).toEqual([]);
        }
      });
    });

    describe('allObject', () => {
      it('should combine object of results', () => {
        const results = {
          name: ok('John'),
          age: ok(30),
          active: ok(true),
        };
        const combined = allObject(results);
        expect(combined.success).toBe(true);
        if (combined.success) {
          expect(combined.data).toEqual({
            name: 'John',
            age: 30,
            active: true,
          });
        }
      });

      it('should return first failure in object', () => {
        const error = new Error('age failed');
        const results = {
          name: ok('John'),
          age: err(error),
          active: ok(true),
        };
        const combined = allObject(results);
        expect(combined.success).toBe(false);
      });
    });

    describe('any', () => {
      it('should return first success', () => {
        const results = [
          err(new Error('first')),
          ok(42),
          err(new Error('third')),
        ];
        const result = any(results);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(42);
        }
      });

      it('should return last error if all fail', () => {
        const results = [
          err(new Error('first')),
          err(new Error('second')),
          err(new Error('third')),
        ];
        const result = any(results);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('third');
        }
      });

      it('should return error for empty array', () => {
        const result = any([]);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('fromNullable', () => {
      it('should return success for non-null value', () => {
        const result = fromNullable(42, new Error('was null'));
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(42);
        }
      });

      it('should return failure for null', () => {
        const error = new Error('was null');
        const result = fromNullable(null, error);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe(error);
        }
      });

      it('should return failure for undefined', () => {
        const error = new Error('was undefined');
        const result = fromNullable(undefined, error);
        expect(result.success).toBe(false);
      });
    });

    describe('match', () => {
      it('should call ok handler for success', () => {
        const result = ok(5);
        const matched = match(result, {
          ok: (x) => x * 2,
          err: () => -1,
        });
        expect(matched).toBe(10);
      });

      it('should call err handler for failure', () => {
        const result = err(new Error('failed'));
        const matched = match(result, {
          ok: () => 42,
          err: (e) => e.message.length,
        });
        expect(matched).toBe(6); // 'failed'.length
      });
    });

    describe('tap', () => {
      it('should call ok handler for success without modifying result', () => {
        let sideEffect = 0;
        const result = ok(42);
        const tapped = tap(result, {
          ok: (x) => {
            sideEffect = x;
          },
        });
        expect(sideEffect).toBe(42);
        expect(tapped).toBe(result); // Same reference
      });

      it('should call err handler for failure without modifying result', () => {
        let sideEffect = '';
        const error = new Error('test');
        const result = err(error);
        const tapped = tap(result, {
          err: (e) => {
            sideEffect = e.message;
          },
        });
        expect(sideEffect).toBe('test');
        expect(tapped).toBe(result);
      });
    });
  });

  describe('Async Combinators', () => {
    describe('mapAsync', () => {
      it('should transform success value asynchronously', async () => {
        const result = ok(5);
        const mapped = await mapAsync(result, async (x) => x * 2);
        expect(mapped.success).toBe(true);
        if (mapped.success) {
          expect(mapped.data).toBe(10);
        }
      });

      it('should preserve failure', async () => {
        const error = new Error('test');
        const result = err(error);
        const mapped = await mapAsync(result, async (x: number) => x * 2);
        expect(mapped.success).toBe(false);
      });
    });

    describe('flatMapAsync', () => {
      it('should chain async operations', async () => {
        const result = ok(5);
        const chained = await flatMapAsync(result, async (x) => ok(x * 2));
        expect(chained.success).toBe(true);
        if (chained.success) {
          expect(chained.data).toBe(10);
        }
      });
    });

    describe('allAsync', () => {
      it('should combine all async success results', async () => {
        const results = [
          Promise.resolve(ok(1)),
          Promise.resolve(ok(2)),
          Promise.resolve(ok(3)),
        ];
        const combined = await allAsync(results);
        expect(combined.success).toBe(true);
        if (combined.success) {
          expect(combined.data).toEqual([1, 2, 3]);
        }
      });

      it('should return first failure from async results', async () => {
        const error = new Error('async failed');
        const results = [
          Promise.resolve(ok(1)),
          Promise.resolve(err(error)),
          Promise.resolve(ok(3)),
        ];
        const combined = await allAsync(results);
        expect(combined.success).toBe(false);
      });
    });
  });
});
