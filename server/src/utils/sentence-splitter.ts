const SENTENCE_ENDERS = /[.!?][\s\n]|[.!?]$/;
const MIN_SENTENCE_LENGTH = 10;

export class SentenceBuffer {
  private buffer = '';

  public append(delta: string): string[] {
    this.buffer += delta;
    const sentences: string[] = [];

    let match = SENTENCE_ENDERS.exec(this.buffer);
    while (match !== null) {
      const end = match.index + 1; // include the punctuation, not the whitespace
      const candidate = this.buffer.slice(0, end).trim();
      if (candidate.length >= MIN_SENTENCE_LENGTH) {
        sentences.push(candidate);
        this.buffer = this.buffer.slice(end).trimStart();
        match = SENTENCE_ENDERS.exec(this.buffer);
      } else {
        break;
      }
    }

    return sentences;
  }

  public flush(): string | null {
    const remaining = this.buffer.trim();
    this.buffer = '';
    return remaining || null;
  }
}
