import { AudioLines, Keyboard, Mic, MicOff, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageAttachButton, ImageAttachment, type ImageData } from '@/components/chat/image-attachment';
import { OrbButton } from '@/components/ui/orb-button';
import { cn } from '@/lib/utils';

type InputMode = 'orb' | 'text';

interface Props {
  /** Whether speech recognition is currently active. */
  isListening: boolean;
  /** Whether the avatar is busy (TTS playing or LLM streaming). */
  isBusy: boolean;
  /** Whether the user has activated the mic at least once in this session. */
  needsActivation: boolean;
  /** Whether the browser supports speech recognition. */
  speechSupported: boolean;
  /** Whether a message is currently being sent/streamed. */
  isLoading: boolean;
  /** Start listening (activates microphone). */
  onStartListening: () => void;
  /** Stop listening (pauses microphone). */
  onStopListening: () => void;
  /** Send a text message, optionally with attached images. */
  onSend: (text: string, images?: ImageData[]) => void;
  /** Called when user first activates the mic. */
  onActivateMic: () => void;
  /** Called when input mode changes (orb = voice, text = typing). */
  onModeChange?: (mode: 'orb' | 'text') => void;
  /** Called when the webcam fails to start. */
  onWebcamError?: () => void;
  /** Extra action buttons rendered alongside the input (e.g. history). */
  actionButtons?: ReactNode;
  /** Current microphone mode. */
  micMode: 'toggle' | 'vad';
  /** Called when the user switches mic mode. */
  onMicModeChange: (mode: 'toggle' | 'vad') => void;
}

export function ChatInput({ isListening, isBusy, needsActivation, speechSupported, isLoading, onStartListening, onStopListening, onSend, onActivateMic, onModeChange, onWebcamError, actionButtons, micMode, onMicModeChange }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<InputMode>('orb');
  const [input, setInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<ImageData[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mode === 'text') {
      textareaRef.current?.focus();
    }
  }, [mode]);

  const handleOrbClick = useCallback(() => {
    if (isListening) {
      onStopListening();
    } else {
      onActivateMic();
      onStartListening();
    }
  }, [isListening, onStartListening, onStopListening, onActivateMic]);

  const switchToText = useCallback(() => {
    onStopListening();
    setMode('text');
    onModeChange?.('text');
  }, [onStopListening, onModeChange]);

  const switchToVoice = useCallback(() => {
    setMode('orb');
    onModeChange?.('orb');
    onActivateMic();
    onStartListening();
  }, [onStartListening, onActivateMic, onModeChange]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) {
      return;
    }
    onSend(text, attachedImages.length > 0 ? attachedImages : undefined);
    setInput('');
    setAttachedImages([]);
  }, [input, isLoading, onSend, attachedImages]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const orbState = isBusy ? 'busy' : isListening ? (micMode === 'vad' ? 'vad' : 'listening') : 'idle';
  const showInvite = needsActivation && !isListening && !isBusy;

  const handleMicModeToggle = useCallback(() => {
    onMicModeChange(micMode === 'toggle' ? 'vad' : 'toggle');
  }, [micMode, onMicModeChange]);

  const orbIcon = isListening
    ? micMode === 'vad'
      ? <AudioLines className="h-6 w-6 text-white" />
      : <Mic className="h-6 w-6 text-white" />
    : <MicOff className="h-6 w-6 text-white" />;

  if (mode === 'orb') {
    return (
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
        {actionButtons}
        <button type="button" onClick={handleMicModeToggle} className={cn('flex size-10 items-center justify-center rounded-full bg-zinc-800/80 backdrop-blur border border-zinc-700 transition-colors', micMode === 'vad' ? 'text-emerald-400 hover:text-emerald-300 hover:bg-zinc-700' : 'text-zinc-400 hover:text-white hover:bg-zinc-700')} aria-label={micMode === 'toggle' ? t('voice.switchToVad') : t('voice.switchToToggle')} title={micMode === 'toggle' ? t('voice.vadMode') : t('voice.toggleMode')}>
          <AudioLines className="h-4 w-4" />
        </button>
        <OrbButton state={showInvite ? 'idle' : orbState} onClick={handleOrbClick} icon={orbIcon} aria-label={isListening ? t('voice.muteMic') : t('voice.resumeListening')} />
        <button type="button" onClick={switchToText} className="flex size-10 items-center justify-center rounded-full bg-zinc-800/80 backdrop-blur border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors" aria-label={t('voice.switchToText')} title={t('voice.textMode')}>
          <Keyboard className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Text mode — bar with textarea, mic button, attach button, send button
  return (
    <div className="absolute bottom-6 left-4 right-4 z-50 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-lg md:px-4">
      <ImageAttachment images={attachedImages} onImagesChange={setAttachedImages} onWebcamError={onWebcamError}>
        <div className="flex flex-col bg-zinc-900/80 backdrop-blur border border-zinc-700 rounded-2xl p-2 transition-all duration-300">
          <div className="flex items-center gap-2">
            {actionButtons}
            {speechSupported && (
              <button type="button" onClick={switchToVoice} className={cn('flex size-10 shrink-0 items-center justify-center rounded-full transition-colors', isListening ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-700')} aria-label={t('voice.switchToVoice')} title={t('voice.voiceMode')}>
                <Mic className="h-4 w-4" />
              </button>
            )}
            <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={t('chat.placeholder')} rows={1} className="flex-1 resize-none bg-transparent rounded-lg px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500" />
            <ImageAttachButton />
            <button type="button" onClick={handleSend} disabled={isLoading || !input.trim()} className="flex size-10 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors disabled:opacity-50" aria-label={t('chat.sendMessage')}>
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </ImageAttachment>
    </div>
  );
}
