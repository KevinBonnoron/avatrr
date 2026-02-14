import { Link } from '@tanstack/react-router';
import { History, Maximize, ScanFace, Settings, Shield, Sparkles, User, Users } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar3D, type CameraPresetControls } from '@/components/avatar-3d';
import { AvatarSheetContent } from '@/components/avatar-sheet-content';
import { ChatPanel } from '@/components/chat-panel';
import { EmotesSheetContent } from '@/components/emotes-sheet-content';
import { HistorySheetContent } from '@/components/history-sheet-content';
import { SettingsSheetContent } from '@/components/settings-sheet-content';
import { IconButton } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAvatar } from '@/contexts/avatar-context';
import type { HistoryMessage } from '@/lib/message';

type SheetId = 'avatar' | 'emotes' | 'settings' | 'history' | null;

export function HomePage() {
  const [openSheet, setOpenSheet] = useState<SheetId>(null);
  const [historyMessages, setHistoryMessages] = useState<HistoryMessage[]>([]);
  const [cameraControls, setCameraControls] = useState<CameraPresetControls | null>(null);
  const { t } = useTranslation();

  const {
    selectedAvatarId,
    animationUrl,
    animation,
    modelPath,
    defaultAnimationUrl,
    appearingAnimationUrl,
    setPlayingAnimationUrl,
    oneShotAnimationUrl,
    onOneShotAnimationFinished,
    effectiveTimeOfDay,
    activeScene,
    showResponseText,
    setShowResponseText,
    timeOfDay,
    setTimeOfDay,
    useSystemTime,
    setUseSystemTime,
    speechLang,
    setSpeechLang,
    avatars,
  } = useAvatar();

  const toggleSheet = useCallback((id: SheetId) => {
    setOpenSheet((prev) => (prev === id ? null : id));
  }, []);

  const closeSheet = useCallback(() => setOpenSheet(null), []);

  return (
    <div className="h-mobile-screen w-full min-w-0 max-w-full relative bg-background pb-[env(safe-area-inset-bottom)] overflow-x-hidden">
      {/* Always-visible menu buttons — top-left */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-1">
        {avatars.length > 0 && (
          <IconButton active={openSheet === 'avatar'} onClick={() => toggleSheet('avatar')} aria-label={t('avatar.title')} title={t('avatar.title')}>
            <Users className="size-5 shrink-0" />
          </IconButton>
        )}
        <IconButton active={openSheet === 'emotes'} onClick={() => toggleSheet('emotes')} aria-label={t('emotes.title')} title={t('emotes.title')}>
          <Sparkles className="size-5 shrink-0" />
        </IconButton>
        <IconButton active={openSheet === 'settings'} onClick={() => toggleSheet('settings')} aria-label={t('settings.title')} title={t('settings.title')}>
          <Settings className="h-4 w-4 shrink-0" />
        </IconButton>
        <Link to="/admin">
          <IconButton aria-label={t('admin.title')} title={t('admin.title')}>
            <Shield className="h-4 w-4 shrink-0" />
          </IconButton>
        </Link>
      </div>

      {/* 3D Avatar — full screen */}
      <div className="absolute inset-0">
        <Avatar3D
          key={`${selectedAvatarId}-${modelPath}`}
          animation={animation}
          modelPath={modelPath}
          activeVrmaUrl={animationUrl}
          defaultAnimationUrl={defaultAnimationUrl}
          appearingAnimationUrl={appearingAnimationUrl}
          onPlayingAnimationChange={setPlayingAnimationUrl}
          oneShotAnimationUrl={oneShotAnimationUrl}
          onOneShotAnimationFinished={onOneShotAnimationFinished}
          timeOfDay={effectiveTimeOfDay}
          onCameraReady={setCameraControls}
          scene={activeScene}
        />
      </div>

      {/* Camera preset buttons — top-right */}
      {cameraControls && (
        <div className="absolute top-4 right-4 z-50 flex flex-col gap-1">
          <IconButton onClick={cameraControls.frameFullBody} aria-label={t('camera.fullBody')} title={t('camera.fullBody')}>
            <Maximize className="size-5 shrink-0" />
          </IconButton>
          <IconButton onClick={cameraControls.frameBust} aria-label={t('camera.bust')} title={t('camera.bust')}>
            <User className="size-5 shrink-0" />
          </IconButton>
          <IconButton onClick={cameraControls.frameFace} aria-label={t('camera.face')} title={t('camera.face')}>
            <ScanFace className="size-5 shrink-0" />
          </IconButton>
        </div>
      )}

      {/* Chat panel — overlays + unified input */}
      <ChatPanel
        onMessagesChange={setHistoryMessages}
        actionButtons={
          <IconButton active={openSheet === 'history'} onClick={() => toggleSheet('history')} aria-label={t('chat.history')} title={t('chat.history')}>
            <History className="h-4 w-4" />
          </IconButton>
        }
      />

      {/* Dialogs (bottom-sheet on mobile, centered modal on desktop) */}
      <Dialog open={openSheet === 'avatar'} onOpenChange={(open) => !open && closeSheet()}>
        <DialogContent showCloseButton={false} className="sm:max-w-2xl">
          <DialogTitle>{t('avatar.title')}</DialogTitle>
          <AvatarSheetContent onClose={closeSheet} />
        </DialogContent>
      </Dialog>

      <Dialog open={openSheet === 'emotes'} onOpenChange={(open) => !open && closeSheet()}>
        <DialogContent showCloseButton={false} className="sm:max-w-xl">
          <DialogTitle>{t('emotes.title')}</DialogTitle>
          <EmotesSheetContent onClose={closeSheet} />
        </DialogContent>
      </Dialog>

      <Dialog open={openSheet === 'settings'} onOpenChange={(open) => !open && closeSheet()}>
        <DialogContent showCloseButton={false}>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <SettingsSheetContent showResponseText={showResponseText} setShowResponseText={setShowResponseText} timeOfDay={timeOfDay} setTimeOfDay={setTimeOfDay} useSystemTime={useSystemTime} setUseSystemTime={setUseSystemTime} speechLang={speechLang} setSpeechLang={setSpeechLang} />
        </DialogContent>
      </Dialog>

      <Dialog open={openSheet === 'history'} onOpenChange={(open) => !open && closeSheet()}>
        <DialogContent showCloseButton={false}>
          <DialogTitle>{t('chat.historyTitle')}</DialogTitle>
          <HistorySheetContent messages={historyMessages} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
