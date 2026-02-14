import type { Expression } from '../types';

export const EXPRESSION_MENU_OPTIONS: readonly { value: Expression; key: string }[] = [
  { value: 'neutral', key: 'expression.neutral' },
  { value: 'happy', key: 'expression.happy' },
  { value: 'sad', key: 'expression.sad' },
  { value: 'angry', key: 'expression.angry' },
  { value: 'surprised', key: 'expression.surprised' },
  { value: 'thinking', key: 'expression.thinking' },
];
