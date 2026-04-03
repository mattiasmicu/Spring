import React, { useEffect, useState } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Layers, Plus, Play, X, Search, Loader2, MoreVertical, FolderOpen, Download, Trash2, Copy, Settings } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import { InstanceSettingsModal } from '../components/InstanceSettingsModal';
import { Button } from '../components/Button';

interface VersionEntry {
  id: string;
  type: string;
  releaseTime: string;
}

export const InstancesPanel: React.FC = () => {
  const { instances, setInstances, pushPanel } = useLauncherStore();
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; instanceId: string } | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<'method' | 'name' | 'loader' | 'version' | 'import' | 'modpack'>('method');
  const [creationMethod, setCreationMethod] = useState<'normal' | 'import' | 'modpack'>('normal');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionFilter, setVersionFilter] = useState<'release' | 'snapshot' | 'all'>('release');
  const [search, setSearch] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedLoader, setSelectedLoader] = useState<'vanilla' | 'fabric' | 'quilt' | 'forge'>('vanilla');

  useEffect(() => {
    invoke<any[]>('list_instances').then((res) => {
      setInstances(res ?? []);
      setLoading(false);
    });
  }, []);

  const handleDeleteInstance = async (instanceId: string) => {
    setDeletingId(instanceId);
    setContextMenu(null);
    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 300));
    try {
      await invoke('delete_instance', { id: instanceId });
      const updated = await invoke<any[]>('list_instances');
      setInstances(updated ?? []);
    } catch (err) {
      console.error('Failed to delete instance:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenFolder = async (instanceId: string) => {
    try {
      await invoke('open_instance_folder', { instanceId });
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
    setContextMenu(null);
  };

  const handleExportModpack = async (instanceId: string) => {
    try {
      await invoke('export_modpack', { instanceId });
    } catch (err) {
      console.error('Failed to export modpack:', err);
    }
    setContextMenu(null);
  };

  const handleDuplicateInstance = async (instanceId: string) => {
    try {
      await invoke('duplicate_instance', { id: instanceId });
      const updated = await invoke<any[]>('list_instances');
      setInstances(updated ?? []);
    } catch (err) {
      console.error('Failed to duplicate instance:', err);
    }
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, instanceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, instanceId });
  };

  const openSettings = (instanceId: string) => {
    setSelectedInstanceId(instanceId);
    setSettingsModalOpen(true);
    setContextMenu(null);
  };

  const openDialog = () => {
    setStep('method');
    setCreationMethod('normal');
    setName('');
    setNameError('');
    setSelectedVersion('');
    setSearch('');
    setVersionFilter('release');
    setCreateError('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (creating) return;
    setDialogOpen(false);
  };

  const handleNameNext = () => {
    const trimmed = name.trim();
    if (!trimmed) { setNameError('Please enter a name.'); return; }
    if (trimmed.length > 32) { setNameError('Max 32 characters.'); return; }
    setNameError('');
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
      await invoke('create_instance', { name: name.trim(), version: selectedVersion, loader: selectedLoader });
      const updated = await invoke<any[]>('list_instances');
      setInstances(updated ?? []);
      setDialogOpen(false);
    } catch (e: any) {
      setCreateError(typeof e === 'string' ? e : 'Failed to create instance.');
    } finally {
      setCreating(false);
    }
  };

  const handleImportFromLauncher = async (launcher: string) => {
    setCreating(true);
    setCreateError('');
    try {
      if (launcher === 'browse') {
        await invoke('import_instance_browse');
      } else {
        await invoke('import_instance_from_launcher', { launcher });
      }
      const updated = await invoke<any[]>('list_instances');
      setInstances(updated ?? []);
      setDialogOpen(false);
    } catch (e: any) {
      setCreateError(typeof e === 'string' ? e : `Failed to import from ${launcher}.`);
    } finally {
      setCreating(false);
    }
  };

  const handleInstallModpack = async (source: string) => {
    setCreating(true);
    setCreateError('');
    try {
      if (source === 'file') {
        await invoke('install_modpack_file');
      } else {
        await invoke('browse_modpacks', { source });
      }
      const updated = await invoke<any[]>('list_instances');
      setInstances(updated ?? []);
      setDialogOpen(false);
    } catch (e: any) {
      setCreateError(typeof e === 'string' ? e : `Failed to install modpack from ${source}.`);
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

  return (
    <div className="h-full flex flex-col p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-p">Instances</h1>
          <p className="text-text-s text-sm">{instances.length} installed</p>
        </div>
        <Button
          onClick={openDialog}
          className="px-4 py-2 text-xs flex items-center gap-2"
        >
          <Plus size={14} /> New Instance
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto pr-2 scroll-hide">
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {instances.map((instance) => (
              <motion.div
                key={instance.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ 
                  opacity: deletingId === instance.id ? 0 : 1, 
                  x: deletingId === instance.id ? -100 : 0,
                  scale: deletingId === instance.id ? 0.95 : 1
                }}
                exit={{ opacity: 0, x: -100, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                onClick={() => pushPanel('instanceDetail', { id: instance.id })}
                className="flex items-center gap-4 p-3 bg-inner2 border border-border rounded-card hover:bg-inner3 transition-colors cursor-pointer group"
              >
                <div className="w-10 h-10 bg-inner3 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center text-text-d">
                  {instance.icon ? <img src={instance.icon} alt="" /> : <Layers size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-text-p truncate">{instance.name}</h3>
                  <p className="text-[10px] text-text-s truncate uppercase tracking-tighter font-bold">
                    {instance.version} · {instance.loader}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); pushPanel('instanceDetail', { id: instance.id }); }}
                    className="w-8 h-8 p-0 flex items-center justify-center"
                  >
                    <Play size={14} fill="currentColor" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={(e) => handleContextMenu(e, instance.id)}
                    className="w-8 h-8 p-0 flex items-center justify-center"
                  >
                    <MoreVertical size={14} />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && <div className="text-center text-text-s text-xs py-4 italic">Loading instances...</div>}
          {!loading && instances.length === 0 && (
            <div className="text-center text-text-s text-sm py-12 border border-dashed border-border rounded-card">
              No instances found. Create your first one!
            </div>
          )}
        </div>
      </div>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div 
          className="fixed bg-inner border border-border rounded-lg shadow-xl z-50 py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <Button
            onClick={() => openSettings(contextMenu.instanceId)}
            variant="ghost"
            className="w-full justify-start text-xs"
          >
            <Settings size={14} className="mr-2" />
            Settings
          </Button>
          <div className="h-px bg-border my-1" />
          <Button
            onClick={() => handleDuplicateInstance(contextMenu.instanceId)}
            variant="ghost"
            className="w-full justify-start text-xs"
          >
            <Copy size={14} className="mr-2" />
            Duplicate
          </Button>
          <Button
            onClick={() => handleOpenFolder(contextMenu.instanceId)}
            variant="ghost"
            className="w-full justify-start text-xs"
          >
            <FolderOpen size={14} className="mr-2" />
            Open Folder
          </Button>
          <Button
            onClick={() => handleExportModpack(contextMenu.instanceId)}
            variant="ghost"
            className="w-full justify-start text-xs"
          >
            <Download size={14} className="mr-2" />
            Export Modpack
          </Button>
          <div className="h-px bg-border my-1" />
          <Button
            onClick={() => handleDeleteInstance(contextMenu.instanceId)}
            variant="ghost"
            className="w-full justify-start text-xs text-red-400 hover:text-red-400"
          >
            <Trash2 size={14} className="mr-2" />
            Delete
          </Button>
        </div>
      )}

      {/* ── New Instance Dialog ── */}
      <AnimatePresence>
        {dialogOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={closeDialog}
              className="fixed inset-0 bg-black/60 z-40"
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div
                className="pointer-events-auto w-[460px] bg-outer border border-border rounded-shell shadow-2xl flex flex-col overflow-hidden"
                style={{ maxHeight: '540px' }}
              >
                {/* Modal header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-inner2 flex-shrink-0">
                  <div>
                    <h2 className="text-sm font-bold text-text-p">New Instance</h2>
                    <p className="text-[11px] text-text-s mt-0.5">
                      {step === 'method' ? 'Choose how to create' : step === 'name' ? 'Step 1 of 3 — Name' : step === 'loader' ? 'Step 2 of 3 — Loader' : step === 'version' ? 'Step 3 of 3 — Version' : step === 'import' ? 'Import from launcher' : 'Install modpack'}
                    </p>
                  </div>
                  <Button onClick={closeDialog} disabled={creating} variant="ghost" className="p-1"><X size={15} /></Button>
                </div>

                <AnimatePresence mode="wait">
                  {/* Step 0: Method Selection */}
                  {step === 'method' && (
                    <motion.div
                      key="method"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.14 }}
                      className="p-5 flex flex-col gap-4"
                    >
                      <div className="grid grid-cols-1 gap-3">
                        <button
                          onClick={() => { setCreationMethod('normal'); setStep('name'); }}
                          className="flex items-center gap-4 p-4 bg-inner2 border border-border rounded-xl hover:border-text-s transition-colors text-left group"
                        >
                          <div className="w-12 h-12 bg-inner3 rounded-lg flex items-center justify-center group-hover:bg-text-p/10 transition-colors">
                            <Plus size={24} className="text-text-p" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-text-p">Create New</h3>
                            <p className="text-xs text-text-s">Choose version and loader manually</p>
                          </div>
                        </button>
                        
                        <button
                          onClick={() => { setCreationMethod('import'); setStep('import'); }}
                          className="flex items-center gap-4 p-4 bg-inner2 border border-border rounded-xl hover:border-text-s transition-colors text-left group"
                        >
                          <div className="w-12 h-12 bg-inner3 rounded-lg flex items-center justify-center group-hover:bg-text-p/10 transition-colors">
                            <Download size={24} className="text-text-p" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-text-p">Import</h3>
                            <p className="text-xs text-text-s">Import from another launcher</p>
                          </div>
                        </button>
                        
                        <button
                          onClick={() => { setCreationMethod('modpack'); setStep('modpack'); }}
                          className="flex items-center gap-4 p-4 bg-inner2 border border-border rounded-xl hover:border-text-s transition-colors text-left group"
                        >
                          <div className="w-12 h-12 bg-inner3 rounded-lg flex items-center justify-center group-hover:bg-text-p/10 transition-colors">
                            <Layers size={24} className="text-text-p" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-text-p">Modpack</h3>
                            <p className="text-xs text-text-s">Install from Modrinth or CurseForge</p>
                          </div>
                        </button>
                      </div>
                      
                      <div className="flex gap-2 mt-2">
                        <Button onClick={closeDialog} variant="outline" className="flex-1 text-xs">Cancel</Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 1: Name */}
                  {step === 'name' && (
                    <motion.div
                      key="name"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.14 }}
                      className="p-5 flex flex-col gap-4"
                    >
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-text-s">Instance Name</label>
                        <input
                          autoFocus
                          type="text"
                          value={name}
                          onChange={e => { setName(e.target.value); setNameError(''); }}
                          onKeyDown={e => e.key === 'Enter' && handleNameNext()}
                          placeholder="e.g. Survival World, Modded 1.21..."
                          maxLength={32}
                          className="bg-inner2 border border-border rounded-md px-3 py-2.5 text-sm text-text-p placeholder:text-text-d outline-none focus:border-text-s transition-colors"
                        />
                        <div className="flex justify-between items-center">
                          {nameError
                            ? <p className="text-[11px] text-red-400">{nameError}</p>
                            : <span />}
                          <p className="text-[10px] text-text-d">{name.length}/32</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={closeDialog} variant="outline" className="flex-1 text-xs">Cancel</Button>
                        <Button onClick={handleNameNext} className="flex-1 text-xs">Next →</Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Loader */}
                  {step === 'loader' && (
                    <motion.div
                      key="loader"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.14 }}
                      className="p-5 flex flex-col gap-4"
                    >
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-text-s">Loader</label>
                        <select
                          value={selectedLoader}
                          onChange={e => setSelectedLoader(e.target.value as 'vanilla' | 'fabric' | 'quilt' | 'forge')}
                          className="bg-inner2 border border-border rounded-md px-3 py-2.5 text-sm text-text-p outline-none focus:border-text-s transition-colors"
                        >
                          <option value="">Select a loader</option>
                          <option value="vanilla">Vanilla</option>
                          <option value="forge">Forge</option>
                          <option value="fabric">Fabric</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => setStep('name')} disabled={creating} variant="outline" className="px-4 text-xs">← Back</Button>
                        <Button onClick={() => { setStep('version'); handleNameNext(); }} className="flex-1 text-xs">Next →</Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Version */}
                  {step === 'version' && (
                    <motion.div
                      key="version"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.14 }}
                      className="flex flex-col flex-1 min-h-0 p-4 gap-3"
                    >
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex bg-inner2 border border-border rounded-md p-0.5 gap-0.5">
                          {(['release', 'snapshot', 'all'] as const).map(f => (
                            <Button
                              key={f}
                              onClick={() => setVersionFilter(f)}
                              variant={versionFilter === f ? 'default' : 'ghost'}
                              className="px-2.5 py-1 text-[10px] font-bold rounded capitalize"
                            >
                              {f}
                            </Button>
                          ))}
                        </div>
                        <div className="flex-1 flex items-center gap-2 bg-inner2 border border-border rounded-md px-2.5 py-1.5">
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

                      <div className="overflow-y-auto bg-inner2 border border-border rounded-card scroll-hide flex-1">
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
                              className={`w-full flex items-center justify-between px-4 py-2 border-b border-border last:border-0 text-left transition-colors ${
                                selectedVersion === v.id ? 'bg-text-p/10 text-text-p' : 'hover:bg-inner3 text-text-s'
                              }`}
                            >
                              <span className="text-xs font-medium">{v.id}</span>
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                v.type === 'release' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                              }`}>
                                {v.type}
                              </span>
                            </button>
                          ))
                        )}
                      </div>

                      {createError && <p className="text-[11px] text-red-400 flex-shrink-0">{createError}</p>}

                      <div className="flex gap-2 flex-shrink-0">
                        <Button onClick={() => setStep('loader')} disabled={creating} variant="outline" className="px-4 text-xs">← Back</Button>
                        <Button onClick={handleCreate} disabled={!selectedVersion || !selectedLoader || creating} className="flex-1 text-xs">
                          {creating
                            ? <><Loader2 size={12} className="animate-spin mr-2" /> Creating...</>
                            : `Create · ${selectedVersion || '—'}`}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Import Step */}
                  {step === 'import' && (
                    <motion.div
                      key="import"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.14 }}
                      className="p-5 flex flex-col gap-4"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <Button onClick={() => handleImportFromLauncher('minecraft')} variant="outline" className="text-xs py-3">
                          Minecraft Launcher
                        </Button>
                        <Button onClick={() => handleImportFromLauncher('prism')} variant="outline" className="text-xs py-3">
                          Prism Launcher
                        </Button>
                        <Button onClick={() => handleImportFromLauncher('modrinth')} variant="outline" className="text-xs py-3">
                          Modrinth
                        </Button>
                        <Button onClick={() => handleImportFromLauncher('lunar')} variant="outline" className="text-xs py-3">
                          Lunar Client
                        </Button>
                        <Button onClick={() => handleImportFromLauncher('feather')} variant="outline" className="text-xs py-3">
                          Feather Client
                        </Button>
                        <Button onClick={() => handleImportFromLauncher('atlauncher')} variant="outline" className="text-xs py-3">
                          ATLauncher
                        </Button>
                      </div>
                      <Button onClick={() => handleImportFromLauncher('browse')} variant="ghost" className="w-full text-xs">
                        Browse for instances folder...
                      </Button>
                      <div className="flex gap-2 mt-2">
                        <Button onClick={() => setStep('method')} variant="outline" className="flex-1 text-xs">← Back</Button>
                      </div>
                    </motion.div>
                  )}

                  {/* Modpack Step */}
                  {step === 'modpack' && (
                    <motion.div
                      key="modpack"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.14 }}
                      className="p-5 flex flex-col gap-4"
                    >
                      <div className="flex flex-col gap-3">
                        <Button onClick={() => handleInstallModpack('modrinth')} variant="outline" className="w-full py-4 flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                            <Download size={18} className="text-green-400" />
                          </div>
                          <div className="text-left">
                            <h3 className="text-sm font-bold">Modrinth</h3>
                            <p className="text-xs text-text-s">Browse and install from Modrinth</p>
                          </div>
                        </Button>
                        <Button onClick={() => handleInstallModpack('curseforge')} variant="outline" className="w-full py-4 flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                            <Download size={18} className="text-orange-400" />
                          </div>
                          <div className="text-left">
                            <h3 className="text-sm font-bold">CurseForge</h3>
                            <p className="text-xs text-text-s">Browse and install from CurseForge</p>
                          </div>
                        </Button>
                        <Button onClick={() => handleInstallModpack('file')} variant="outline" className="w-full py-4 flex items-center gap-3">
                          <div className="w-8 h-8 bg-inner3 rounded-lg flex items-center justify-center">
                            <Layers size={18} className="text-text-p" />
                          </div>
                          <div className="text-left">
                            <h3 className="text-sm font-bold">From File</h3>
                            <p className="text-xs text-text-s">Import .zip, .mrpack, or .json</p>
                          </div>
                        </Button>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button onClick={() => setStep('method')} variant="outline" className="flex-1 text-xs">← Back</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <InstanceSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        instanceId={selectedInstanceId}
      />
      <InstanceSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        instanceId={selectedInstanceId}
      />
    </div>
  );
};