import type { Expression } from '@avatrr/shared';
import { getConfigStore } from '../stores/config.store';

/** Resolve a raw string (e.g. from wire or tag) to a valid Expression using config valid + emotionMapping. Defaults to 'neutral'. */
export function resolveExpression(raw: string): Expression {
  const { valid, emotionMapping } = getConfigStore().expressionConfig;
  const lower = raw?.toLowerCase().trim() ?? '';
  if (valid.includes(lower as Expression)) {
    return lower as Expression;
  }
  if (emotionMapping[lower]) {
    return emotionMapping[lower];
  }
  return 'neutral';
}
