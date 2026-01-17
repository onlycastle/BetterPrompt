/**
 * AWS Lambda Response Streaming Types
 *
 * Type definitions for Lambda's awslambda global object
 * used with response streaming.
 */

import { Writable } from "node:stream";

declare global {
  namespace awslambda {
    /**
     * Wrap a handler to enable response streaming
     */
    function streamifyResponse<T>(
      handler: (
        event: T,
        responseStream: Writable,
        context: unknown
      ) => Promise<void>
    ): (event: T, context: unknown) => Promise<void>;

    namespace HttpResponseStream {
      /**
       * Create a response stream with HTTP metadata
       */
      function from(
        responseStream: Writable,
        metadata: {
          statusCode: number;
          headers: Record<string, string>;
        }
      ): Writable;
    }
  }
}

export {};
