import { createFileRoute, Link, Outlet, useMatches } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  AudioLines,
  Brain,
  Clapperboard,
  Database,
  Image,
  MessagesSquare,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});

const tabs: { id: string; labelKey: string; icon: LucideIcon }[] = [
  { id: '/admin/avatars', labelKey: 'admin.nav.avatars', icon: Users },
  { id: '/admin/animations', labelKey: 'admin.nav.animations', icon: Clapperboard },
  { id: '/admin/llm', labelKey: 'admin.nav.llm', icon: Brain },
  { id: '/admin/tts', labelKey: 'admin.nav.tts', icon: AudioLines },
  { id: '/admin/scenes', labelKey: 'admin.nav.scenes', icon: Image },
  { id: '/admin/memory', labelKey: 'admin.nav.memory', icon: Database },
  { id: '/admin/conversations', labelKey: 'admin.nav.conversations', icon: MessagesSquare },
];

function AdminLayout() {
  const { t } = useTranslation();
  const matches = useMatches();
  const currentPath = matches[matches.length - 1]?.fullPath ?? '/admin';

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-900/80 backdrop-blur w-14 md:w-56">
        <div className="px-2 py-4">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors justify-center md:justify-start"
            title={t('admin.backToApp')}
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span className="hidden md:inline">{t('admin.backToApp')}</span>
          </Link>
        </div>

        <h1 className="hidden md:block px-4 pb-3 text-lg font-semibold text-white">
          {t('admin.title')}
        </h1>

        <nav className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentPath === tab.id;
            return (
              <Link
                key={tab.id}
                to={tab.id}
                title={t(tab.labelKey)}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors justify-center md:justify-start ${
                  isActive
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="hidden md:inline">{t(tab.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
