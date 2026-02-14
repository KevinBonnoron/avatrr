import type { ChatMessageTextPart, ChatRequestMessage } from '@avatrr/shared';

export function getMessageContent(msg: ChatRequestMessage): string {
  if (typeof msg.content === 'string') {
    return msg.content;
  }
  if (msg.parts?.length) {
    return msg.parts
      .filter((p): p is ChatMessageTextPart => p.type === 'text')
      .map((p) => p.content)
      .join('');
  }
  return '';
}

export function isAbortError(err: unknown): boolean {
  return (err instanceof DOMException || err instanceof Error) && err.name === 'AbortError';
}
