import { Shirt } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PortraitThumb } from '@/components/portrait-thumb';
import { TabBar } from '@/components/ui/tab-bar';
import { useAvatar } from '@/contexts/avatar-context';
import { assetUrl } from '@/lib/config';
import { cn } from '@/lib/utils';

interface Props {
  onClose: () => void;
}

export function AvatarSheetContent({ onClose }: Props) {
  const { t } = useTranslation();
  const { avatars, animations, selectedAvatarId, setSelectedAvatarId, outfits, selectedOutfitId, setSelectedOutfitId } = useAvatar();
  const hasOutfits = outfits.length > 1;
  const [activeTab, setActiveTab] = useState<'avatars' | 'outfits'>('avatars');

  const selectedAvatar = avatars.find((a) => a.id === selectedAvatarId);
  const selectedIdleId = selectedAvatar?.animations?.idle;
  const selectedIdleAnim = selectedIdleId ? animations.find((a) => a.id === selectedIdleId) : undefined;
  const selectedPoseUrl = selectedIdleAnim ? assetUrl(selectedIdleAnim.url) : undefined;

  if (avatars.length === 0) {
    return <p className="text-sm text-zinc-500 italic">{t('avatar.title')}</p>;
  }

  const tabs = [{ id: 'avatars', label: t('avatar.title') }, ...(hasOutfits ? [{ id: 'outfits', label: t('avatar.outfits') }] : [])];

  return (
    <div className="flex flex-col gap-3">
      {hasOutfits && <TabBar tabs={tabs} activeId={activeTab} onTabChange={(id) => setActiveTab(id as 'avatars' | 'outfits')} />}

      {activeTab === 'avatars' && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {avatars.map((avatar) => {
            const isSelected = selectedAvatarId === avatar.id;
            const idleId = avatar.animations?.idle;
            const idleAnim = idleId ? animations.find((a) => a.id === idleId) : undefined;
            const poseUrl = idleAnim ? assetUrl(idleAnim.url) : undefined;
            return (
              <button
                key={avatar.id}
                type="button"
                onClick={() => {
                  setSelectedAvatarId(avatar.id);
                  if (avatar.outfits.length > 1) {
                    setActiveTab('outfits');
                  } else {
                    onClose();
                  }
                }}
                className={cn('flex flex-col items-center gap-2 rounded-xl p-2 transition-colors', isSelected ? 'bg-primary/20 ring-1 ring-primary/50' : 'hover:bg-zinc-800')}
                role="menuitem"
              >
                <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <PortraitThumb modelPath={(avatar.outfits.find((o) => o.default) ?? avatar.outfits[0])?.modelPath ?? ''} name={avatar.name} poseUrl={poseUrl} />
                  {avatar.outfits.length > 1 && (
                    <span className="absolute bottom-1 right-1 flex size-5 items-center justify-center rounded-full bg-zinc-900/80 backdrop-blur border border-zinc-600">
                      <Shirt className="size-3 text-zinc-300" />
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-white truncate w-full text-center">{avatar.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'outfits' && hasOutfits && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {outfits.map((outfit) => {
            const isSelected = selectedOutfitId === outfit.id;
            return (
              <button
                key={outfit.id}
                type="button"
                onClick={() => {
                  setSelectedOutfitId(outfit.id);
                  onClose();
                }}
                className={cn('flex flex-col items-center gap-2 rounded-xl p-2 transition-colors', isSelected ? 'bg-primary/20 ring-1 ring-primary/50' : 'hover:bg-zinc-800')}
                role="menuitem"
              >
                <div className="aspect-square w-full rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <PortraitThumb modelPath={outfit.modelPath} name={outfit.label} poseUrl={selectedPoseUrl} />
                </div>
                <span className="text-xs font-medium text-white truncate w-full text-center">{outfit.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
