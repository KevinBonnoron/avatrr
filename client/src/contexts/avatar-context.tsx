import type { AnimationConfig, AvatarConfig, Expression, OutfitConfig, SceneConfig } from '@avatrr/shared';
import { findAvatarById, getAvailableAnimationsForAvatar, getDefaultAvatarId } from '@avatrr/shared';
import { createContext, type PropsWithChildren, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { AvatarAnimationControls } from '@/hooks/useAvatarAnimation';
import { useAvatarAnimation } from '@/hooks/useAvatarAnimation';
import { useIdleBehavior } from '@/hooks/useIdleBehavior';
import { assetUrl } from '@/lib/config';
import { removeLipSyncCallback, setLipSyncCallback } from '@/lib/tts';

const STORAGE_KEY = 'avatrr-selected-avatar';
const OUTFIT_STORAGE_KEY = 'avatrr-selected-outfits';
const TIME_OF_DAY_STORAGE_KEY = 'avatrr-time-of-day';
const USE_SYSTEM_TIME_STORAGE_KEY = 'avatrr-use-system-time';

/** Load per-avatar outfit selections from localStorage. */
function loadOutfitMap(): Record<string, string> {
  if (typeof localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(OUTFIT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Persist per-avatar outfit selections to localStorage. */
function saveOutfitMap(map: Record<string, string>): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(OUTFIT_STORAGE_KEY, JSON.stringify(map));
  }
}

/** Get the default outfit for an avatar (the one with default: true, or the first). */
function getDefaultOutfit(outfits: readonly OutfitConfig[]): OutfitConfig | undefined {
  return outfits.find((o) => o.default) ?? outfits[0];
}

export interface AvatarContextValue {
  avatars: readonly AvatarConfig[];
  animations: readonly AnimationConfig[];
  selectedAvatarId: string;
  setSelectedAvatarId: (id: string) => void;
  selectedAvatar: AvatarConfig | undefined;
  expression: Expression;
  setExpression: (expr: Expression) => void;
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;
  /** Whether the avatar is currently receiving a streamed response. */
  isReceiving: boolean;
  setIsReceiving: (receiving: boolean) => void;
  spokenText: string | null;
  setSpokenText: (text: string | null) => void;
  animationUrl: string | null;
  setAnimationUrl: (url: string | null) => void;
  /** Currently playing animation URL (from VRM mixer). Used to reflect actual playback in the animation menu. */
  playingAnimationUrl: string | null;
  setPlayingAnimationUrl: (url: string | null) => void;
  /** Play an animation once by config id (e.g. from SSE). When finished, reverts to the current selection. */
  playAnimationOnce: (animationId: string) => void;
  /** URL of a one-shot animation to play (from SSE). Null when none or after it finished. */
  oneShotAnimationUrl: string | null;
  /** Called when the one-shot animation has finished playing. */
  onOneShotAnimationFinished: () => void;
  showResponseText: boolean;
  setShowResponseText: (show: boolean) => void;
  /** Time of day in hours (0–24) for scene lighting. Used when useSystemTime is false. */
  timeOfDay: number;
  setTimeOfDay: (hours: number) => void;
  /** When true, scene lighting follows the system clock. */
  useSystemTime: boolean;
  setUseSystemTime: (use: boolean) => void;
  /** Effective time of day (system hour when useSystemTime, else timeOfDay). */
  effectiveTimeOfDay: number;
  speechLang: string;
  setSpeechLang: (lang: string) => void;
  animation: AvatarAnimationControls;
  /** Currently selected outfit ID (null when avatar has no outfits). */
  selectedOutfitId: string | null;
  setSelectedOutfitId: (id: string | null) => void;
  /** Available outfits for the selected avatar (empty when none). */
  outfits: readonly OutfitConfig[];
  modelPath: string;
  availableAnimations: AnimationConfig[];
  animationUrls: string[];
  /** URL of the animation to play after appearing (from avatar.defaultAnimationId). */
  defaultAnimationUrl: string | null;
  /** URL of the animation to play as intro when the avatar appears (from avatar.animations.appearing). */
  appearingAnimationUrl: string | null;
  /** Active scene/background for the selected avatar, or null if none. */
  activeScene: SceneConfig | null;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

export interface AvatarProviderProps extends PropsWithChildren {
  avatars: readonly AvatarConfig[];
  animations: readonly AnimationConfig[];
  scenes?: readonly SceneConfig[];
}

export function AvatarProvider({ avatars, animations, scenes = [], children }: AvatarProviderProps): ReactNode {
  const [expression, setExpression] = useState<Expression>('neutral');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [spokenText, setSpokenText] = useState<string | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('');
  const [animationUrl, setAnimationUrl] = useState<string | null>(null);
  const [playingAnimationUrl, setPlayingAnimationUrl] = useState<string | null>(null);
  const [oneShotAnimationUrl, setOneShotAnimationUrl] = useState<string | null>(null);
  const [showResponseText, setShowResponseText] = useState(true);
  const [speechLang, setSpeechLang] = useState('en-US');
  const [timeOfDay, setTimeOfDayState] = useState(() => {
    if (typeof localStorage === 'undefined') {
      return 12;
    }
    const v = localStorage.getItem(TIME_OF_DAY_STORAGE_KEY);
    const n = v != null ? Number.parseFloat(v) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 24 ? n : 12;
  });
  const [useSystemTime, setUseSystemTimeState] = useState(() => {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    const v = localStorage.getItem(USE_SYSTEM_TIME_STORAGE_KEY);
    return v === 'true';
  });
  const [effectiveTimeOfDay, setEffectiveTimeOfDay] = useState(() => (useSystemTime ? new Date().getHours() + new Date().getMinutes() / 60 : timeOfDay));

  const setTimeOfDay = (hours: number) => {
    const h = Math.max(0, Math.min(24, hours));
    setTimeOfDayState(h);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TIME_OF_DAY_STORAGE_KEY, String(h));
    }
    if (!useSystemTime) {
      setEffectiveTimeOfDay(h);
    }
  };
  const setUseSystemTime = (use: boolean) => {
    setUseSystemTimeState(use);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USE_SYSTEM_TIME_STORAGE_KEY, String(use));
    }
    if (use) {
      setEffectiveTimeOfDay(new Date().getHours() + new Date().getMinutes() / 60);
    } else {
      setEffectiveTimeOfDay(timeOfDay);
    }
  };

  useEffect(() => {
    if (!useSystemTime) {
      return;
    }
    const update = () => setEffectiveTimeOfDay(new Date().getHours() + new Date().getMinutes() / 60);
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [useSystemTime]);

  useEffect(() => {
    if (!useSystemTime) {
      setEffectiveTimeOfDay(timeOfDay);
    }
  }, [useSystemTime, timeOfDay]);

  const animation = useAvatarAnimation();

  // Set initial avatar once loaded
  useEffect(() => {
    if (avatars.length > 0 && !selectedAvatarId) {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      const valid = stored && findAvatarById(avatars, stored);
      setSelectedAvatarId(valid ? stored : getDefaultAvatarId(avatars));
    }
  }, [avatars, selectedAvatarId]);

  useEffect(() => {
    if (selectedAvatarId && findAvatarById(avatars, selectedAvatarId)) {
      localStorage.setItem(STORAGE_KEY, selectedAvatarId);
    }
  }, [selectedAvatarId, avatars]);

  useEffect(() => {
    animation.play(isSpeaking ? 'talking' : 'idle');
  }, [isSpeaking, animation]);

  useEffect(() => {
    animation.setExpression(expression);
  }, [expression, animation]);

  useEffect(() => {
    setLipSyncCallback((data) => animation.setLipSync(data));
    return () => removeLipSyncCallback();
  }, [animation]);

  const selectedAvatar = findAvatarById(avatars, selectedAvatarId) ?? avatars[0];
  const outfits = selectedAvatar?.outfits ?? [] as readonly OutfitConfig[];

  // Per-avatar outfit selection (persisted as a map { avatarId: outfitId })
  const [outfitMap, setOutfitMap] = useState<Record<string, string>>(loadOutfitMap);

  const selectedOutfitId = outfits.length > 0 ? (outfitMap[selectedAvatarId] ?? getDefaultOutfit(outfits)?.id ?? null) : null;

  const setSelectedOutfitId = useCallback(
    (id: string | null) => {
      setOutfitMap((prev) => {
        const next = { ...prev };
        if (id) {
          next[selectedAvatarId] = id;
        } else {
          delete next[selectedAvatarId];
        }
        saveOutfitMap(next);
        return next;
      });
    },
    [selectedAvatarId],
  );

  const availableAnimations = getAvailableAnimationsForAvatar(animations, selectedAvatar);
  const animationUrls = availableAnimations.map(({ url }) => assetUrl(url));

  const playAnimationOnce = useCallback(
    (animationId: string) => {
      const anim = availableAnimations.find((a) => a.id === animationId);
      if (anim) {
        setOneShotAnimationUrl(assetUrl(anim.url));
      }
    },
    [availableAnimations],
  );

  // Idle behavior: random animations from a pool when the avatar is not busy
  const idlePool = selectedAvatar?.animations?.idlePool ?? [];
  useIdleBehavior({
    idlePool,
    minInterval: selectedAvatar?.animations?.idleMinInterval,
    maxInterval: selectedAvatar?.animations?.idleMaxInterval,
    isBusy: isSpeaking || isReceiving,
    playAnimationOnce,
  });

  const idleId = selectedAvatar?.animations?.idle;
  const defaultAnimationMatch = idleId ? animations.find(({ id }) => id === idleId) : undefined;
  const defaultAnimationUrl = defaultAnimationMatch ? assetUrl(defaultAnimationMatch.url) : null;

  const appearingId = selectedAvatar?.animations?.appearing;
  const appearingAnimationMatch = appearingId ? animations.find(({ id }) => id === appearingId) : undefined;
  const appearingAnimationUrl = appearingAnimationMatch ? assetUrl(appearingAnimationMatch.url) : null;

  useEffect(() => {
    if (animationUrl && !animationUrls.includes(animationUrl)) {
      setAnimationUrl(null);
    }
  }, [animationUrl, animationUrls]);

  // Use the selected outfit's modelPath, or fall back to the default outfit.
  const activeOutfit = selectedOutfitId ? outfits.find((o) => o.id === selectedOutfitId) : undefined;
  const modelPath = assetUrl(activeOutfit?.modelPath ?? getDefaultOutfit(outfits)?.modelPath ?? '');

  // Resolve the active scene for the selected avatar
  const sceneId = selectedAvatar?.scene;
  const activeScene = sceneId ? (scenes.find((s) => s.id === sceneId) ?? null) : null;

  const value: AvatarContextValue = {
    avatars,
    animations,
    selectedAvatarId,
    setSelectedAvatarId,
    selectedAvatar,
    expression,
    setExpression,
    isSpeaking,
    setIsSpeaking,
    isReceiving,
    setIsReceiving,
    spokenText,
    setSpokenText,
    animationUrl,
    setAnimationUrl,
    playingAnimationUrl,
    setPlayingAnimationUrl,
    playAnimationOnce,
    oneShotAnimationUrl,
    onOneShotAnimationFinished: () => setOneShotAnimationUrl(null),
    showResponseText,
    setShowResponseText,
    timeOfDay,
    setTimeOfDay,
    useSystemTime,
    setUseSystemTime,
    effectiveTimeOfDay,
    speechLang,
    setSpeechLang,
    animation,
    selectedOutfitId,
    setSelectedOutfitId,
    outfits,
    modelPath,
    availableAnimations,
    animationUrls,
    defaultAnimationUrl,
    appearingAnimationUrl,
    activeScene,
  };

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useAvatar(): AvatarContextValue {
  const ctx = useContext(AvatarContext);
  if (ctx === null) {
    throw new Error('useAvatar must be used within AvatarProvider');
  }
  return ctx;
}
