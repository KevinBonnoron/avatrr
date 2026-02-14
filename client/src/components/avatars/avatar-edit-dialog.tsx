import type { ConfigAvatarEntry, ConfigTtsEntry, SceneConfig } from '@avatrr/shared';
import { Save, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimationsTab } from './animations-tab';
import { LlmTab } from './llm-tab';
import { OutfitsTab } from './outfits-tab';
import { TtsTab } from './tts-tab';
import { FormField } from '@/components/atoms/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabBar } from '@/components/ui/tab-bar';
import { useModels } from '@/hooks/useFiles';

export type AvatarEntry = ConfigAvatarEntry;

type DialogTab = 'outfits' | 'llm' | 'tts' | 'animations';

const DIALOG_TABS: { id: DialogTab; labelKey: string }[] = [
  { id: 'outfits', labelKey: 'admin.avatars.outfits' },
  { id: 'llm', labelKey: 'admin.nav.llm' },
  { id: 'tts', labelKey: 'admin.nav.tts' },
  { id: 'animations', labelKey: 'admin.nav.animations' },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const EMPTY_AVATAR: AvatarEntry = { id: '', name: '', outfits: [{ id: 'default', label: 'Default', modelPath: '', default: true }] };

interface Props {
  entry?: AvatarEntry;
  onSave: (entry: AvatarEntry) => void;
  isPending?: boolean;
  llmNames: string[];
  ttsNames: string[];
  ttsConfigs: Record<string, ConfigTtsEntry>;
  animationList: { id: string; label: string }[];
  scenes?: SceneConfig[];
  defaultTab?: DialogTab;
  children: React.ReactNode;
}

export function AvatarEditDialog({ entry, onSave, isPending, llmNames, ttsNames, ttsConfigs, animationList, scenes = [], defaultTab = 'outfits', children }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AvatarEntry>({ ...EMPTY_AVATAR });
  const [dialogTab, setDialogTab] = useState<DialogTab>(defaultTab);
  const { data: modelFiles = [] } = useModels();
  const isEdit = entry != null;

  const modelOptions = modelFiles.map((f) => ({ label: f.name, value: f.url }));

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setDialogTab(defaultTab);
      if (entry) {
        setEditing({
          ...entry,
          llm: entry.llm ? { ...entry.llm, overrides: { ...entry.llm.overrides } } : undefined,
          tts: entry.tts ? { ...entry.tts, overrides: { ...entry.tts.overrides } } : undefined,
          animations: entry.animations ? { ...entry.animations, available: entry.animations.available ? [...entry.animations.available] : undefined } : undefined,
          outfits: entry.outfits.map((o) => ({ ...o })),
        });
      } else {
        setEditing({ ...EMPTY_AVATAR, outfits: [{ id: 'default', label: 'Default', modelPath: '', default: true }] });
      }
    }
  }

  function handleSave() {
    const cleaned: AvatarEntry = { ...editing };
    if (!cleaned.scene) {
      cleaned.scene = undefined;
    }
    if (cleaned.llm && 'ref' in cleaned.llm && !cleaned.llm.ref) {
      cleaned.llm = undefined;
    }
    if (!cleaned.tts?.ref) {
      cleaned.tts = undefined;
    }
    if (cleaned.llm && cleaned.llm.memory !== false) {
      cleaned.llm = { ...cleaned.llm, memory: undefined };
    }
    if (cleaned.animations) {
      if (!cleaned.animations.available?.length) {
        cleaned.animations.available = undefined;
      }
      if (!cleaned.animations.idle) {
        cleaned.animations.idle = undefined;
      }
      if (!cleaned.animations.appearing) {
        cleaned.animations.appearing = undefined;
      }
      // Remove the whole animations object if empty
      if (!cleaned.animations.available && !cleaned.animations.idle && !cleaned.animations.appearing && !cleaned.animations.expressionMapping) {
        cleaned.animations = undefined;
      }
    }
    onSave(cleaned);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogTitle>{isEdit ? t('admin.avatars.edit') : t('admin.avatars.create')}</DialogTitle>
        <div className="space-y-3">
          {/* General fields */}
          <FormField label={t('admin.avatars.name')}>
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value, id: slugify(e.target.value) })} placeholder="Mon Avatar" />
          </FormField>
          {scenes.length > 0 && (
            <FormField label={t('admin.avatars.scene')}>
              <Select value={editing.scene ?? '__none__'} onValueChange={(v) => setEditing({ ...editing, scene: v === '__none__' ? undefined : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('admin.none')}</SelectItem>
                  {scenes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {/* Tabs */}
          <TabBar tabs={DIALOG_TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey) }))} activeId={dialogTab} onTabChange={(id) => setDialogTab(id as DialogTab)} />

          <div className="h-[500px] overflow-y-auto">
            {dialogTab === 'outfits' && <OutfitsTab editing={editing} onChange={setEditing} modelOptions={modelOptions} />}
            {dialogTab === 'llm' && <LlmTab editing={editing} onChange={setEditing} llmNames={llmNames} />}
            {dialogTab === 'tts' && <TtsTab editing={editing} onChange={setEditing} ttsNames={ttsNames} ttsConfigs={ttsConfigs} />}
            {dialogTab === 'animations' && <AnimationsTab editing={editing} onChange={setEditing} animationList={animationList} />}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              <X className="size-4" />
              {t('admin.cancel')}
            </Button>
          </DialogClose>
          <Button size="sm" onClick={handleSave} disabled={!editing.name || !slugify(editing.name) || !editing.outfits?.some((o) => o.label && o.modelPath) || isPending}>
            <Save className="size-4" />
            {t('admin.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
