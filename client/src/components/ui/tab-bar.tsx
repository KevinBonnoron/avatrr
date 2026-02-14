import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  activeId: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function TabBar({ tabs, activeId, onTabChange, className }: Props) {
  return (
    <div className={cn('flex gap-1 rounded-lg bg-zinc-800/60 p-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', activeId === tab.id ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
