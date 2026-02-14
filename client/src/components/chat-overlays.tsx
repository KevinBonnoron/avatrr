import { useTranslation } from 'react-i18next';

interface Props {
  /** Error message displayed as-is in a red banner. Caller is responsible for formatting. */
  error: string | null;
  showConnecting: boolean;
  responseText: string;
  /** When TTS is speaking, this is the text currently being read (overrides responseText when set). */
  spokenText?: string | null;
  showResponseText: boolean;
  isStreaming: boolean;
  isSpeaking?: boolean;
  interimTranscript: string;
  isListening: boolean;
  className?: string;
}

export function ChatOverlays({ error, showConnecting, responseText, spokenText, showResponseText, isStreaming, isSpeaking, interimTranscript, isListening, className }: Props) {
  const { t } = useTranslation();
  const textToShow = isSpeaking && spokenText != null && spokenText !== '' ? spokenText : responseText;
  const showTextOverlay = showResponseText || (spokenText != null && spokenText !== '');
  const hasContent = error || showConnecting || showTextOverlay || (isListening && interimTranscript);
  if (!hasContent) {
    return null;
  }

  return (
    <div className={`min-w-0 w-full max-w-full overflow-hidden ${className ?? ''}`}>
      {error && (
        <div className="w-full min-w-0 px-4 py-2 rounded-lg bg-red-900/40 backdrop-blur text-sm text-red-200 break-words" role="alert">
          {error}
        </div>
      )}
      {showTextOverlay && textToShow && (
        <div className="w-full min-w-0 px-4 py-2 rounded-lg bg-black/60 backdrop-blur text-sm text-white whitespace-pre-wrap break-words max-h-32 overflow-y-auto overflow-x-hidden">
          {textToShow}
          {isStreaming && !spokenText && <span className="animate-pulse">|</span>}
        </div>
      )}
      {showConnecting && (
        <div className="w-full min-w-0 px-4 py-2 rounded-lg bg-black/60 backdrop-blur text-sm text-zinc-400 italic break-words">
          {t('chat.connecting')}
          <span className="animate-pulse">|</span>
        </div>
      )}
      {isListening && interimTranscript && (
        <div className="w-full min-w-0 px-4 py-2 rounded-lg bg-black/60 backdrop-blur text-sm text-zinc-300 italic break-words">
          {interimTranscript}
          <span className="animate-pulse">|</span>
        </div>
      )}
    </div>
  );
}
