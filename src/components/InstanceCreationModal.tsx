import { Button } from './Button';
import React, { useState, useEffect, useRef } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { X, Search, Loader2, Upload } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/DialogPrimitive';

interface VersionEntry {
  id: string;
  type: string;
  releaseTime: string;
}

interface InstanceCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const loaders = [
  { id: 'vanilla', name: 'Vanilla', desc: 'Pure Minecraft, no mods' },
  { id: 'fabric', name: 'Fabric', desc: 'Lightweight, modern mod loader' },
  { id: 'quilt', name: 'Quilt', desc: 'Community-driven mod loader' },
  { id: 'forge', name: 'Forge', desc: 'Classic, widely used mod loader' },
  { id: 'neoforge', name: 'NeoForge', desc: 'Modern Forge fork' },
];

const STEPS = ['name', 'loader', 'version'] as const;
type Step = typeof STEPS[number];

export const InstanceCreationModal: React.FC<InstanceCreationModalProps> = ({ isOpen, onClose }) => {
  const { setInstances } = useLauncherStore();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [selectedLoader, setSelectedLoader] = useState('vanilla');
  const [customIcon, setCustomIcon] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionFilter, setVersionFilter] = useState<'release' | 'snapshot' | 'all'>('release');
  const [search, setSearch] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('name');
      setName('');
      setNameError('');
      setSelectedLoader('vanilla');
      setCustomIcon(null);
      setSelectedVersion('');
      setSearch('');
      setVersionFilter('release');
      setCreateError('');
    }
  }, [isOpen]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCustomIcon(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleNameNext = () => {
    const trimmed = name.trim();
    if (!trimmed) { setNameError('Please enter a name.'); return; }
    if (trimmed.length > 32) { setNameError('Max 32 characters.'); return; }
    setNameError('');
    setStep('loader');
  };

  const handleLoaderNext = () => {
    setStep('version');
    setVersionsLoading(true);
    invoke<{ versions: VersionEntry[] }>('fetch_version_manifest')
      .then(m => {
        setVersions(m.versions);
        const latest = m.versions.find(v => v.type === 'release');
        if (latest) setSelectedVersion(latest.id);
      })
      .catch(() => setCreateError('Failed to fetch versions. Check your connection.'))
      .finally(() => setVersionsLoading(false));
  };

  const handleCreate = async () => {
    if (!selectedVersion || creating) return;
    setCreating(true);
    setCreateError('');
    try {
      const instance = await invoke<any>('create_instance', {
        name: name.trim(),
        version: selectedVersion,
        loader: selectedLoader,
        icon: customIcon,
      });

      if (selectedLoader !== 'vanilla' && instance?.id) {
        try {
          const loaderVersions = await invoke<any[]>('get_loader_versions', {
            loader: selectedLoader,
            mcVersion: selectedVersion,
          });
          const stableVersion = loaderVersions.find((v: any) => v.stable) || loaderVersions[0];
          if (stableVersion) {
            await invoke('install_loader', {
              instanceId: instance.id,
              loader: selectedLoader,
              mcVersion: selectedVersion,
              loaderVersion: stableVersion.version,
            });
          }
        } catch (e: any) {
          console.error('Failed to install loader:', e);
        }
      }

      const updated = await invoke<any[]>('list_instances');
      setInstances(updated ?? []);
      onClose();
    } catch (e: any) {
      setCreateError(typeof e === 'string' ? e : 'Failed to create instance.');
    } finally {
      setCreating(false);
    }
  };

  const filtered = versions.filter(v => {
    if (versionFilter === 'release' && v.type !== 'release') return false;
    if (versionFilter === 'snapshot' && v.type !== 'snapshot') return false;
    if (search && !v.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stepIndex = STEPS.indexOf(step);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !creating) onClose(); }}>
      <DialogContent
        className="p-0 gap-0 w-[500px] bg-inner border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: '600px' }}
      >
        {/* ── Top bar: title + close ── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div>
            <DialogTitle className="text-sm font-bold text-text-p">New Instance</DialogTitle>
            <p className="text-[11px] text-text-d mt-0.5">
              {step === 'name' ? 'Step 1 of 3 — Name & Icon' : step === 'loader' ? 'Step 2 of 3 — Choose Loader' : 'Step 3 of 3 — Pick Version'}
            </p>
          </div>
          <button
            onClick={() => { if (!creating) onClose(); }}
            disabled={creating}
            className="text-text-d hover:text-text-s transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-inner2"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Inner content panel (the light rounded card) ── */}
        <div className="bg-inner2 mx-2 rounded-xl flex flex-col overflow-hidden flex-1 min-h-0">
          <AnimatePresence mode="wait">

            {/* Step 1: Name & Icon */}
            {step === 'name' && (
              <motion.div
                key="name"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.15 }}
                className="p-5 flex flex-col gap-4"
              >
                <div className="flex gap-4 items-start">
                  {/* Icon upload */}
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-[72px] h-[72px] bg-inner border-2 border-dashed border-border rounded-xl flex items-center justify-center cursor-pointer overflow-hidden hover:border-text-d transition-colors"
                    >
                      {customIcon
                        ? <img src={customIcon} alt="" className="w-full h-full object-cover" />
                        : <Upload size={20} className="text-text-d" />}
                    </div>
                    <span className="text-[10px] text-text-d">Icon</span>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </div>

                  {/* Name */}
                  <div className="flex-1 flex flex-col gap-1.5 pt-0.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-text-s">Instance Name</label>
                    <input
                      autoFocus
                      type="text"
                      value={name}
                      onChange={e => { setName(e.target.value); setNameError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleNameNext()}
                      placeholder="e.g. Survival World, Modded 1.21..."
                      maxLength={32}
                      className="bg-inner border border-border rounded-lg px-3 py-2.5 text-sm text-text-p placeholder:text-text-d outline-none focus:border-text-d transition-colors"
                    />
                    <div className="flex justify-between">
                      {nameError ? <p className="text-[10px] text-red-400">{nameError}</p> : <span />}
                      <p className="text-[10px] text-text-d">{name.length}/32</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Loader */}
            {step === 'loader' && (
              <motion.div
                key="loader"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.15 }}
                className="p-5 flex flex-col gap-2"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-d mb-1">Select Mod Loader</p>
                {loaders.map(loader => (
                  <button
                    key={loader.id}
                    onClick={() => setSelectedLoader(loader.id)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-colors ${
                      selectedLoader === loader.id
                        ? 'border-text-p bg-text-p/10'
                        : 'border-border bg-inner hover:border-text-d'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-sm text-text-p leading-none">{loader.name}</p>
                      <p className="text-[11px] text-text-s mt-1">{loader.desc}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      selectedLoader === loader.id ? 'border-text-p bg-text-p' : 'border-border'
                    }`}>
                      {selectedLoader === loader.id && <div className="w-1.5 h-1.5 bg-inner rounded-full" />}
                    </div>
                  </button>
                ))}
              </motion.div>
            )}

            {/* Step 3: Version */}
            {step === 'version' && (
              <motion.div
                key="version"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col flex-1 min-h-0 p-4 gap-3"
              >
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex bg-inner border border-border rounded-lg p-0.5 gap-0.5">
                    {(['release', 'snapshot', 'all'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setVersionFilter(f)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md capitalize cursor-pointer transition-colors ${
                          versionFilter === f ? 'bg-text-p text-inner' : 'text-text-s hover:text-text-p'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 flex items-center gap-2 bg-inner border border-border rounded-lg px-2.5 py-1.5">
                    <Search size={11} className="text-text-d flex-shrink-0" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search versions..."
                      className="flex-1 bg-transparent text-xs text-text-p placeholder:text-text-d outline-none"
                    />
                  </div>
                </div>

                <div className="overflow-y-auto bg-inner border border-border rounded-xl scroll-hide flex-1 max-h-[280px]">
                  {versionsLoading ? (
                    <div className="flex items-center justify-center p-8 gap-2 text-text-s text-xs">
                      <Loader2 size={13} className="animate-spin" /> Loading versions...
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="p-6 text-center text-text-s text-xs">No versions match.</div>
                  ) : (
                    filtered.map(v => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVersion(v.id)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0 text-left cursor-pointer transition-colors ${
                          selectedVersion === v.id ? 'bg-text-p/10' : 'hover:bg-inner2'
                        }`}
                      >
                        <span className={`text-xs font-medium ${selectedVersion === v.id ? 'text-text-p' : 'text-text-s'}`}>
                          {v.id}
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          v.type === 'release' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                        }`}>
                          {v.type}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {createError && <p className="text-[10px] text-red-400 flex-shrink-0">{createError}</p>}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ── Footer: step pills + action buttons (lives in the dark outer shell) ── */}
        <div className="flex items-center gap-3 px-4 py-4 flex-shrink-0">
          {/* Step pills (like the 3 rounded rects in the screenshot) */}
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIndex
                    ? 'w-5 bg-text-p'
                    : i < stepIndex
                    ? 'w-1.5 bg-text-s'
                    : 'w-1.5 bg-border'
                }`}
              />
            ))}
          </div>

          <div className="flex-1 flex gap-2">
            {/* Back / Cancel */}
            {step === 'name' ? (
              <Button
                onClick={() => { if (!creating) onClose(); }}
                variant="ghost"
                className="px-4 py-2 text-xs"
              >
                Cancel
              </Button>
            ) : (
              <Button
                onClick={() => setStep(STEPS[stepIndex - 1])}
                disabled={creating}
                variant="ghost"
                className="px-4 py-2 text-xs"
              >
                ← Back
              </Button>
            )}

            {/* Next / Create */}
            {step === 'name' && (
              <Button
                onClick={handleNameNext}
                className="flex-1 py-2 text-xs"
              >
                Continue →
              </Button>
            )}
            {step === 'loader' && (
              <Button
                onClick={handleLoaderNext}
                className="flex-1 py-2 text-xs"
              >
                Continue →
              </Button>
            )}
            {step === 'version' && (
              <Button
                onClick={handleCreate}
                disabled={!selectedVersion || creating}
                className="flex-1 py-2 text-xs flex items-center justify-center gap-2"
              >
                {creating
                  ? <><Loader2 size={12} className="animate-spin" /> Creating...</>
                  : `Create · ${selectedVersion || '—'}`}
              </Button>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};