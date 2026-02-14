import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HomePage } from '@/components/home-page';
import { AvatarProvider } from '@/contexts/avatar-context';
import { useAnimations } from '@/hooks/useAnimations';
import { useAvatars } from '@/hooks/useAvatars';
import { useScenes } from '@/hooks/useScenes';

export const Route = createFileRoute('/')({
  component: IndexComponent,
});

function IndexComponent() {
  const { t } = useTranslation();
  const { data: avatars = [], isLoading: avatarsIsLoading } = useAvatars();
  const { data: animations = [], isLoading: animationsIsLoading } = useAnimations();
  const { data: scenes = [], isLoading: scenesIsLoading } = useScenes();
  const isLoading = avatarsIsLoading || animationsIsLoading || scenesIsLoading;

  if (isLoading) {
    return <div className="h-mobile-screen flex items-center justify-center bg-background text-muted-foreground">{t('loadingAvatars')}</div>;
  }

  return (
    <AvatarProvider avatars={avatars} animations={animations} scenes={scenes}>
      <HomePage />
    </AvatarProvider>
  );
}
