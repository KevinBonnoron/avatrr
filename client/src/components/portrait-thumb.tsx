import { Loader2 } from 'lucide-react';
import { useAvatarPortrait } from '@/hooks/useAvatarPortrait';

interface Props {
  modelPath: string;
  name: string;
  /** URL of a VRMA animation to apply as idle pose. When omitted the portrait shows T-pose. */
  poseUrl?: string;
}

export function PortraitThumb({ modelPath, name, poseUrl }: Props) {
  const { dataUrl, loading, error, request } = useAvatarPortrait(modelPath, { lazy: true, poseUrl });

  const fallback = <span className="text-lg font-semibold text-zinc-500">{name.slice(0, 1)}</span>;

  return (
    <div className="size-full flex items-center justify-center" onMouseEnter={request} role="presentation">
      {loading && <Loader2 className="size-6 animate-spin text-zinc-500" />}
      {!loading && (error || !dataUrl) && fallback}
      {!loading && dataUrl && <img src={dataUrl} alt="" className="size-full object-cover" />}
    </div>
  );
}
