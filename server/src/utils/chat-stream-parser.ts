import type { Expression, StreamChunk } from '@avatrr/shared';
import { logger } from '../lib/logger';
import { resolveExpression } from '../services';

/** Raw token from any LLM provider. The parser consumes this and emits StreamChunk. */
export interface RawToken {
  readonly token: string;
  readonly done?: boolean;
}

function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
}

function stripEmojis(text: string): string {
  return text.replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F?/gu, '');
}

/** Strip [EMOTION=...], [ANIMATION=...], simple [emotion], and *emotion* tags. */
function stripTags(text: string): string {
  return text
    .replace(/\[EMOTION[=:]\s*\w+\]\s*/gi, '')
    .replace(/\[ANIMATION[=:]\s*\w+\]\s*/gi, '')
    .replace(/\[(\w+)\]\s*/g, (match, word, offset) => {
      const resolved = resolveExpression(word);
      const isKnown = resolved !== 'neutral' || word.toLowerCase() === 'neutral';
      // Strip known emotions + leading bracket tags (unrecognised emotion attempts by the LLM)
      const strip = isKnown || offset === 0;
      return strip ? '' : match;
    })
    .replace(/\*(\w+)\*\s*/g, (match, word, offset) => {
      const resolved = resolveExpression(word);
      const isKnown = resolved !== 'neutral' || word.toLowerCase() === 'neutral';
      const strip = isKnown || offset === 0;
      return strip ? '' : match;
    });
}

const TAG_PREFIXES = ['[ANIMATION=', '[EMOTION='];

/** Length of suffix that looks like an incomplete tag (no closing ]). Do not emit this yet. Handles "[", "[A", "[AN", ... "[ANIMATION=dancing". */
function incompleteTagSuffixLength(text: string): number {
  let maxHold = 0;
  for (let len = 1; len <= text.length; len++) {
    const suffix = text.slice(-len);
    const couldBeTag = TAG_PREFIXES.some((p) => p.startsWith(suffix) || (suffix.startsWith(p) && /^\w*$/.test(suffix.slice(p.length))));
    if (couldBeTag) {
      maxHold = len;
    }
  }
  return maxHold;
}

function parseAnimation(text: string): string | null {
  const m = text.match(/\[ANIMATION[=:]\s*(\w+)\]/i);
  return m?.[1] ?? null;
}

function parseExpression(text: string): Expression | null {
  const emotionTag = text.match(/\[EMOTION[=:]\s*(\w+)\]/i);
  const simple = text.match(/\[(\w+)\]/);
  const asterisk = text.match(/\*(\w+)\*/);
  const raw = (emotionTag?.[1] ?? simple?.[1] ?? asterisk?.[1])?.toLowerCase();
  if (!raw) {
    return null;
  }
  const resolved = resolveExpression(raw);
  // Accept known emotions, or leading tags (offset 0) as emotion attempts even if unrecognised
  const match = emotionTag ?? simple ?? asterisk;
  if (resolved === 'neutral' && raw !== 'neutral' && match && match.index !== 0) {
    return null;
  }
  return resolved;
}

/**
 * Turn a raw token stream (from any LLM provider) into StreamChunk events.
 * Handles <think> blocks, [EMOTION=...], [ANIMATION=...], strips tags from text.
 * Emits STREAM_START, EXPRESSION, ANIMATION, TEXT, STREAM_END.
 */
export async function* parseChatStream(rawStream: AsyncIterable<RawToken>): AsyncGenerator<StreamChunk, void, undefined> {
  const runId = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const now = () => Date.now();

  yield { type: 'STREAM_START', runId, messageId, timestamp: now() };

  let rawText = '';
  let insideThink = false;
  let expression: Expression = 'neutral';
  let expressionParsed = false;
  let headerDone = false;
  let expressionSent = false;
  let animationSent = false;
  /** Length of clean text already emitted (tags stripped from accumulated raw). Handles tags split across tokens. */
  let lastEmittedCleanLength = 0;

  for await (const { token, done } of rawStream) {
    rawText += token;
    if (insideThink) {
      if (rawText.includes('</think>')) {
        insideThink = false;
        rawText = stripThinkBlocks(rawText);
        // Fall through to process the remaining text after think block
      } else {
        if (done) {
          yield { type: 'STREAM_END', runId, messageId, timestamp: now() };
        }
        continue;
      }
    }

    if (rawText.includes('<think>') && !rawText.includes('</think>')) {
      insideThink = true;
      continue;
    }
    if (rawText.includes('</think>')) {
      rawText = stripThinkBlocks(rawText);
    }

    if (!expressionParsed) {
      const detected = parseExpression(rawText);
      if (detected) {
        expression = detected;
        expressionParsed = true;
      } else if (rawText.length > 50) {
        expressionParsed = true;
      } else {
        continue;
      }
    }

    if (!expressionSent) {
      expressionSent = true;
      yield { type: 'EXPRESSION', expression, timestamp: now() };
    }

    const animationId = parseAnimation(rawText);
    if (!animationSent && animationId) {
      animationSent = true;
      yield { type: 'ANIMATION', animationId, timestamp: now() };
    }

    if (!headerDone) {
      headerDone = true;
      const cleaned = stripEmojis(stripTags(rawText));
      const trimmed = cleaned.trim();
      if (trimmed) {
        yield { type: 'TEXT', messageId, delta: trimmed, timestamp: now() };
      }

      lastEmittedCleanLength = cleaned.length;
      continue;
    }

    const fullClean = stripEmojis(stripTags(rawText));
    const suffixHold = done ? 0 : incompleteTagSuffixLength(fullClean);
    const safeLength = fullClean.length - suffixHold;
    if (safeLength < lastEmittedCleanLength) {
      lastEmittedCleanLength = 0;
    }

    const delta = fullClean.slice(lastEmittedCleanLength, safeLength);
    lastEmittedCleanLength = safeLength;
    if (delta) {
      yield { type: 'TEXT', messageId, delta, timestamp: now() };
    }

    if (done) {
      yield { type: 'STREAM_END', runId, messageId, timestamp: now() };
    }
  }

  if (!headerDone) {
    if (!expressionSent && expression !== 'neutral') {
      yield { type: 'EXPRESSION', expression, timestamp: now() };
    }
    const animId = parseAnimation(rawText);
    if (!animationSent && animId) {
      yield { type: 'ANIMATION', animationId: animId, timestamp: now() };
    }
    const cleaned = stripEmojis(stripTags(stripThinkBlocks(rawText)).trim() || rawText);
    if (cleaned) {
      yield { type: 'TEXT', messageId, delta: cleaned, timestamp: now() };
    } else {
      yield { type: 'TEXT', messageId, delta: '...', timestamp: now() };
    }
    yield { type: 'STREAM_END', runId, messageId, timestamp: now() };
  }
}
