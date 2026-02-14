import type { StreamChunk } from '@avatrr/shared';

/**
 * Turn an async iterable of StreamChunk into an SSE HTTP Response.
 */
export function streamToSSEResponse(stream: AsyncIterable<StreamChunk>, options: { abortController?: AbortController } = {}): Response {
  const { abortController } = options;
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (abortController?.signal.aborted) {
            break;
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
      } catch (err) {
        if ((err as { name?: string }).name !== 'AbortError') {
          controller.error(err);
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      abortController?.abort();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
