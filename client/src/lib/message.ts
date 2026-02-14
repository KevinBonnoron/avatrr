export interface HistoryMessage {
  role: string;
  parts: Array<{ type: string; content?: string }>;
}

export function getMessageText(message: HistoryMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; content: string } => p.type === 'text' && typeof p.content === 'string')
    .map((p) => p.content)
    .join('');
}
