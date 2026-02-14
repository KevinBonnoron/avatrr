import type { StreamChunk } from '@avatrr/shared';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatInput } from '@/components/chat-input';
import { ChatOverlays } from '@/components/chat-overlays';
import { useAvatar } from '@/contexts/avatar-context';
import { useChat } from '@/hooks/useChat';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import type { HistoryMessage } from '@/lib/message';
import { getMessageText } from '@/lib/message';
import { AudioChunkQueue } from '@/lib/tts';

type MicMode = 'toggle' | 'vad';

interface ChatPanelProps {
  onMessagesChange?: (messages: HistoryMessage[]) => void;
  actionButtons?: ReactNode;
}

export function ChatPanel({ onMessagesChange, actionButtons }: ChatPanelProps = {}) {
  const { t } = useTranslation();
  const { selectedAvatarId: avatarId, selectedAvatar, setExpression: onExpressionChange, setIsSpeaking: onSpeakingChange, setSpokenText: onSpeakingTextChange, playAnimationOnce, isSpeaking, spokenText, showResponseText: showResponseTextSetting, speechLang, animation, setIsReceiving } = useAvatar();

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micMode, setMicMode] = useState<MicMode>('toggle');
  const [hasUserActivatedMic, setHasUserActivatedMic] = useState(false);
  const hasUserActivatedMicRef = useRef(false);
  const userHasPausedMicRef = useRef(false);
  const voiceModeActiveRef = useRef(true);
  const sendMessageRef = useRef<((text: string) => Promise<void>) | null>(null);
  hasUserActivatedMicRef.current = hasUserActivatedMic;
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Show an error that auto-dismisses after a delay. */
  const showError = useCallback((msg: string, autoHideMs?: number) => {
    clearTimeout(errorTimerRef.current);
    setError(msg);
    if (autoHideMs) {
      errorTimerRef.current = setTimeout(() => setError(null), autoHideMs);
    }
  }, []);

  const {
    isListening,
    interimTranscript,
    supported,
    errorCode,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition({
    continuous: micMode === 'vad',
    lang: speechLang,
    hintWords: selectedAvatar?.speechRecognition?.hintWords,
    restartOnEndDelayMs: selectedAvatar?.speechRecognition?.restartOnEndDelayMs ?? 1200,
    flushOnFinalResult: micMode === 'vad',
    onResult: (transcript) => {
      sendMessageRef.current?.(transcript);
    },
  });

  // Translate speech recognition error codes into the unified error
  useEffect(() => {
    if (errorCode) {
      showError(t(`errors.${errorCode}`));
    }
  }, [errorCode, showError, t]);

  const callbacksRef = useRef({ onExpressionChange, onSpeakingChange, onSpeakingTextChange, playAnimationOnce, animation, setIsReceiving });
  callbacksRef.current = { onExpressionChange, onSpeakingChange, onSpeakingTextChange, playAnimationOnce, animation, setIsReceiving };
  const avatarIdRef = useRef(avatarId);
  avatarIdRef.current = avatarId;

  const queueRef = useRef<AudioChunkQueue | null>(null);
  if (!queueRef.current) {
    queueRef.current = new AudioChunkQueue();
  }
  queueRef.current.callbacks = {
    onSpeakingChange: (speaking) => callbacksRef.current.onSpeakingChange(speaking),
    onSpeakingTextChange: (text) => callbacksRef.current.onSpeakingTextChange?.(text),
  };

  const handleChunk = useCallback((chunk: StreamChunk) => {
    if (chunk.type === 'CONNECTING') {
      setIsConnecting(true);
    }
    if (chunk.type === 'STREAM_START') {
      callbacksRef.current.setIsReceiving(true);
    }
    if (chunk.type === 'EXPRESSION') {
      callbacksRef.current.onExpressionChange(chunk.expression);
    }
    if (chunk.type === 'TEXT' || chunk.type === 'STREAM_ERROR' || chunk.type === 'STREAM_END') {
      setIsConnecting(false);
    }
    if (chunk.type === 'STREAM_END' || chunk.type === 'STREAM_ERROR') {
      callbacksRef.current.setIsReceiving(false);
    }
    if (chunk.type === 'STREAM_ERROR' && 'error' in chunk && chunk.error?.message) {
      showError(chunk.error.message);
    }
    if (chunk.type === 'TTS_AUDIO') {
      queueRef.current?.enqueue(chunk.audio);
    }
    if (chunk.type === 'ANIMATION') {
      callbacksRef.current.playAnimationOnce(chunk.animationId);
    }
    if (chunk.type === 'MOOD') {
      callbacksRef.current.animation.setMood(chunk.mood, chunk.intensity);
    }
  }, [showError]);

  const { messages, sendMessage, isLoading, status, clear } = useChat({
    getBody: () => ({ avatarId: avatarIdRef.current }),
    onChunk: handleChunk,
  });

  const prevAvatarIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevAvatarIdRef.current !== null && prevAvatarIdRef.current !== avatarId) {
      setError(null);
      queueRef.current?.stop();
      queueRef.current?.reset();
      clear();
    }
    prevAvatarIdRef.current = avatarId;
  }, [avatarId, clear]);

  const doSend = useCallback(
    async (text: string, images?: Array<{ data: string; mimeType: string }>) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      setError(null);
      queueRef.current?.stop();
      queueRef.current?.reset();
      sendMessage(trimmed, images);
    },
    [sendMessage],
  );

  sendMessageRef.current = doSend;

  // Restart recognition when mic mode changes so the new continuous/flush settings take effect.
  const prevMicModeRef = useRef(micMode);
  useEffect(() => {
    const prev = prevMicModeRef.current;
    prevMicModeRef.current = micMode;
    if (prev !== micMode && hasUserActivatedMicRef.current && voiceModeActiveRef.current) {
      stopListening();
      const t = setTimeout(() => startListening(), 100);
      return () => clearTimeout(t);
    }
  }, [micMode, startListening, stopListening]);

  // Pause mic only during LLM streaming (avoid echo). Keep mic active during TTS for barge-in.
  const isStreaming = status === 'streaming';
  const isBusy = isSpeaking || isStreaming;
  useEffect(() => {
    if (!voiceModeActiveRef.current) {
      return;
    }
    if (isStreaming) {
      stopListening();
      userHasPausedMicRef.current = false;
    } else if (hasUserActivatedMicRef.current && !userHasPausedMicRef.current) {
      startListening();
    }
  }, [isStreaming, startListening, stopListening]);

  const lastAssistant = [...messages].reverse().find(({ role }) => role === 'assistant');
  const lastAssistantText = lastAssistant ? getMessageText(lastAssistant) : '';
  const hasTts = selectedAvatar?.hasTts === true;
  const showResponseText = !!(showResponseTextSetting && lastAssistantText && (isStreaming || isSpeaking || !hasTts));

  const overlayProps = {
    error,
    showConnecting: isConnecting,
    responseText: lastAssistantText,
    spokenText,
    showResponseText,
    isStreaming,
    isSpeaking,
    interimTranscript,
    isListening,
  };

  const historyMessages = useMemo<HistoryMessage[]>(() => messages.map((m) => ({ role: m.role, parts: m.parts ?? [] })), [messages]);

  const onMessagesChangeRef = useRef(onMessagesChange);
  onMessagesChangeRef.current = onMessagesChange;
  useEffect(() => {
    onMessagesChangeRef.current?.(historyMessages);
  }, [historyMessages]);

  const overlayContainerClass = 'absolute bottom-28 left-0 right-0 px-4 min-[764px]:left-1/2 min-[764px]:right-auto min-[764px]:-translate-x-1/2 min-[764px]:w-full min-[764px]:max-w-lg min-[764px]:px-4 z-50 flex flex-col items-center gap-2';

  const handleStartListening = useCallback(() => {
    voiceModeActiveRef.current = true;
    startListening();
  }, [startListening]);

  const handleStopListening = useCallback(() => {
    userHasPausedMicRef.current = true;
    stopListening();
  }, [stopListening]);

  const handleActivateMic = useCallback(() => {
    userHasPausedMicRef.current = false;
    setHasUserActivatedMic(true);
  }, []);

  const handleModeChange = useCallback((mode: 'orb' | 'text') => {
    voiceModeActiveRef.current = mode === 'orb';
  }, []);

  const handleWebcamError = useCallback(() => {
    showError(t('chat.webcamError'), 4000);
  }, [showError, t]);

  return (
    <>
      <div className={overlayContainerClass}>
        <ChatOverlays {...overlayProps} className="min-w-0 w-full max-w-full" />
      </div>
      <ChatInput
        isListening={isListening}
        isBusy={isBusy}
        needsActivation={!hasUserActivatedMic}
        speechSupported={supported}
        isLoading={isLoading}
        onStartListening={handleStartListening}
        onStopListening={handleStopListening}
        onSend={doSend}
        onActivateMic={handleActivateMic}
        onModeChange={handleModeChange}
        onWebcamError={handleWebcamError}
        actionButtons={actionButtons}
        micMode={micMode}
        onMicModeChange={setMicMode}
      />
    </>
  );
}
