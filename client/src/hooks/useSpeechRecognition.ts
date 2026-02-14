import { useCallback, useRef, useState } from 'react';

export interface UseSpeechRecognitionOptions {
  /** Language for recognition (e.g. 'fr-FR', 'en-US'). Defaults to document lang or browser locale. */
  lang?: string;
  /** Keep listening after each utterance. When false, recognition stops after the first pause and fires onResult automatically. Defaults to true. */
  continuous?: boolean;
  /** Optional words/phrases to improve recognition (e.g. character names). Uses SpeechGrammarList when supported. */
  hintWords?: readonly string[];
  /** When set (ms), recognition restarts after the browser ends a phrase so the mic stays on longer. E.g. 1200. */
  restartOnEndDelayMs?: number;
  /** Called when a final transcript is available (e.g. when user stops speaking or recognition ends). */
  onResult?: (transcript: string) => void;
  /** When true and continuous, fire onResult immediately when a final result is detected rather than waiting for onend. Useful for VAD mode. */
  flushOnFinalResult?: boolean;
}

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/** Normalize language to a locale Chrome accepts (e.g. fr -> fr-FR). */
function normalizeLang(lang: string): string {
  const lower = lang.split('-')[0]?.toLowerCase() ?? 'en';
  const map: Record<string, string> = { fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', it: 'it-IT' };
  return map[lower] ?? (lang.includes('-') ? lang : `${lower}-${lower.toUpperCase()}`);
}

/** Build a JSGF grammar string from hint words so the recognizer prefers them. */
function buildHintGrammar(hintWords: readonly string[]): string {
  const escaped = hintWords
    .filter((w) => w.trim().length > 0)
    .map((w) => `"${w.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(' | ');
  if (!escaped) {
    return '';
  }
  return `#JSGF V1.0; grammar hint; public <hint> = ${escaped};`;
}

/**
 * Hook for browser Speech Recognition (Web Speech API).
 * Uses continuous mode and interim results so the UI can show live transcript.
 * Call onResult when recognition ends to get the full final transcript.
 */
export type SpeechRecognitionErrorCode = 'not_supported' | 'start_failed' | 'recognition_error';

export function useSpeechRecognition({ lang, continuous = true, hintWords, restartOnEndDelayMs = 0, onResult, flushOnFinalResult = false }: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorCode, setErrorCode] = useState<SpeechRecognitionErrorCode | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string[]>([]);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const userRequestedStopRef = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const doStartRef = useRef<() => void>(() => {});

  const supported = getSpeechRecognition() !== null;

  const stop = useCallback(() => {
    userRequestedStopRef.current = true;
    if (restartTimeoutRef.current !== undefined) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = undefined;
    }
    const rec = recognitionRef.current;
    if (!rec) {
      setIsListening(false);
      setInterimTranscript('');
      return;
    }
    try {
      // abort() releases the microphone immediately; stop() can leave it active in some browsers
      if (typeof rec.abort === 'function') {
        rec.abort();
      } else {
        rec.stop();
      }
    } catch {
      // ignore if already stopped
    }
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript('');
    // Final transcript is flushed in onend to avoid double callback
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      setErrorCode('not_supported');
      return;
    }

    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      return;
    }

    userRequestedStopRef.current = false;
    if (restartTimeoutRef.current !== undefined) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = undefined;
    }

    const doStart = (): void => {
      setErrorCode(null);
      finalTranscriptRef.current = [];
      setInterimTranscript('');

      const rec = new Ctor();
      rec.continuous = continuous;
      rec.interimResults = true;
      const rawLang = lang ?? document.documentElement.lang ?? navigator.language ?? 'en-US';
      rec.lang = normalizeLang(rawLang);

      if (typeof SpeechGrammarList !== 'undefined' && hintWords?.length) {
        const grammarStr = buildHintGrammar(hintWords);
        if (grammarStr) {
          try {
            const grammarList = new SpeechGrammarList();
            grammarList.addFromString(grammarStr, 1);
            rec.grammars = grammarList;
          } catch {
            // Some browsers may not support grammars or reject the format; ignore
          }
        }
      }

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onend = () => {
        recognitionRef.current = null;
        const snapshot = [...finalTranscriptRef.current];
        finalTranscriptRef.current = [];

        const flushResult = (): void => {
          setTimeout(() => {
            const full = snapshot.join(' ').trim();
            if (full) {
              onResultRef.current?.(full);
            }
          }, 200);
        };

        if (restartOnEndDelayMs > 0 && !userRequestedStopRef.current) {
          flushResult();
          setInterimTranscript('');
          restartTimeoutRef.current = setTimeout(() => {
            restartTimeoutRef.current = undefined;
            if (!userRequestedStopRef.current) {
              doStartRef.current?.();
            }
          }, restartOnEndDelayMs);
          return;
        }

        setIsListening(false);
        setInterimTranscript('');
        flushResult();
      };

      rec.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === 'aborted' || e.error === 'no-speech') {
          return;
        }
        setErrorCode('recognition_error');
        recognitionRef.current = null;
        setIsListening(false);
        setInterimTranscript('');
      };

      rec.onresult = (e: SpeechRecognitionEvent) => {
        let interim = '';
        let hasFinal = false;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          const alternative = result[0] ?? result.item?.(0);
          const text = (alternative?.transcript ?? '').trim();
          if (!text) {
            continue;
          }
          if (result.isFinal) {
            finalTranscriptRef.current.push(text);
            setInterimTranscript('');
            hasFinal = true;
          } else {
            interim += text;
          }
        }
        if (interim) {
          setInterimTranscript(interim);
        }
        // In VAD mode, fire onResult immediately when a final result is detected
        if (hasFinal && flushOnFinalResult) {
          const full = finalTranscriptRef.current.join(' ').trim();
          if (full) {
            onResultRef.current?.(full);
          }
          finalTranscriptRef.current = [];
        }
      };

      recognitionRef.current = rec;
      try {
        rec.start();
      } catch {
        setErrorCode('start_failed');
        recognitionRef.current = null;
      }
    };

    doStartRef.current = doStart;
    doStart();
  }, [supported, lang, continuous, hintWords, restartOnEndDelayMs, flushOnFinalResult]);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  return {
    isListening,
    interimTranscript,
    supported,
    errorCode,
    start,
    stop,
    toggle,
  };
}
