import React, { useState, useEffect, useRef } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import {
  Play, Package, Folder, FileText, Download, Terminal,
  Square, Copy, Check, ArrowLeft, Plus, FolderOpen,
  FileCode, FileJson, FileImage, Archive,
} from 'lucide-react';
import { ModBrowser } from '../components/ModBrowser';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import {
  Files, FileItem, FolderItem, FolderTrigger, FolderContent, SubFiles,
} from '../components/animate-ui/components/radix/files';

function fileIcon(name: string): React.ElementType {
  if (name.endsWith('.jar') || name.endsWith('.zip')) return Archive;
  if (name.endsWith('.json'))                          return FileJson;
  if (name.endsWith('.png') || name.endsWith('.jpg'))  return FileImage;
  if (name.endsWith('.toml') || name.endsWith('.cfg')) return FileCode;
  return FileText;
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024)        return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

interface FSEntry { name: string; path: string; is_dir: boolean; size: number; }

export const InstanceDetailPanel: React.FC<{ id: string }> = ({ id }) => {
  const { instances, logs, appendLog, clearLogs, settings, auth, downloadProgress, updateDownloadProgress } = useLauncherStore();
  const instance = instances.find(i => i.id === id);

  const [activeTab, setActiveTab]     = useState<'mods' | 'files' | 'logs'>('mods');
  const [status, setStatus]           = useState<'ready' | 'downloading' | 'launching' | 'running'>('ready');
  const [stageLabel, setStageLabel]   = useState('');
  const [copied, setCopied]           = useState(false);
  const [files, setFiles]             = useState<FSEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName]       = useState('');
  // null = currently loading, FSEntry[] = loaded, undefined = not opened yet
  const [subFiles, setSubFiles] = useState<Record<string, FSEntry[] | null>>({});
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ul1 = listen('launch-log',        (e: any) => appendLog(e.payload.line, e.payload.level));
    const ul2 = listen('download-log',      (e: any) => appendLog(e.payload.message, e.payload.level));
    const ul3 = listen('download-progress', (e: any) => {
      const p = e.payload;
      updateDownloadProgress({ file: p.file, current: p.current, total: p.total, percent: p.percent });
      if      (p.stage === 'client')    setStageLabel('Downloading client...');
      else if (p.stage === 'libraries') setStageLabel(`Libraries ${p.current}/${p.total}`);
      else if (p.stage === 'assets')    setStageLabel(`Assets ${p.current}/${p.total}`);
      else if (p.stage === 'done')      setStageLabel('Download complete!');
    });
    const ul4 = listen('launch-exit', () => {
      setStatus('ready'); setStageLabel(''); appendLog('Minecraft exited.', 'info');
    });
    return () => { ul1.then(f=>f()); ul2.then(f=>f()); ul3.then(f=>f()); ul4.then(f=>f()); };
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, activeTab]);

  useEffect(() => {
    if (status === 'downloading' || status === 'launching') setActiveTab('logs');
  }, [status]);

  useEffect(() => {
    if (activeTab === 'files' && instance) {
      loadDir(currentPath, setFiles);
      setSubFiles({});
    }
  }, [activeTab, instance, currentPath]);

  const loadDir = async (relPath: string, setter: (f: FSEntry[]) => void) => {
    if (!instance) return;
    try {
      const list = await invoke<FSEntry[]>('list_instance_files', {
        instanceId: instance.id,
        subPath: relPath || null,
      });
      setter(list);
    } catch (e) { console.error('list_instance_files:', e); }
  };

  // Called when accordion opens — loads children using the entry's relative path
  const handleFolderOpen = (relPath: string) => {
    if (subFiles[relPath] !== undefined) return; // already loaded/loading
    setSubFiles(prev => ({ ...prev, [relPath]: null })); // null = loading
    loadDir(relPath, list =>
      setSubFiles(prev => ({ ...prev, [relPath]: list }))
    );
  };

  const handleOpenFinder = () =>
    instance && invoke('open_in_finder', { instanceId: instance.id }).catch(console.error);

  const handleCreateFolder = async () => {
    if (!instance || !newFolderName.trim()) return;
    const rel = currentPath ? `${currentPath}/${newFolderName.trim()}` : newFolderName.trim();
    await invoke('create_folder', { instanceId: instance.id, relativePath: rel }).catch(console.error);
    setNewFolderName(''); setShowCreateFolder(false);
    loadDir(currentPath, setFiles);
  };

  const handlePlay = async () => {
    if (!instance || !auth) return;
    clearLogs(); setActiveTab('logs'); setStatus('downloading'); setStageLabel('Starting download...');
    try {
      const requiredJava = await invoke<number>('get_java_version_requirement', { versionId: instance.version });
      appendLog(`Minecraft ${instance.version} requires Java ${requiredJava}`, 'info');
      let javaPath = await invoke<string>('detect_java_version', { requiredVersion: requiredJava.toString() });
      if (!javaPath) {
        appendLog(`Downloading Java ${requiredJava}...`, 'info');
        const os = await invoke<string>('get_os'); const arch = await invoke<string>('get_arch');
        javaPath = await invoke<string>('download_java', { os, arch, version: requiredJava });
        appendLog(`Java ${requiredJava} downloaded`, 'info');
      } else { appendLog('Using existing Java installation', 'info'); }
      await invoke('download_version', { versionId: instance.version });
      setStatus('launching'); setStageLabel('Launching...');
      appendLog('Launching Minecraft...', 'info');
      await invoke('launch_instance', { id: instance.id, javaPath, ramMb: settings.ramMb, username: auth.username, uuid: auth.uuid, accessToken: auth.token });
      setStatus('running'); setStageLabel('Running');
    } catch (err) { appendLog(`Launch error: ${err}`, 'error'); setStatus('ready'); setStageLabel(''); }
  };

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] ${l.line}`).join('\n');
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  if (!instance) return <div className="p-8 text-text-s">Instance not found.</div>;

  const breadcrumb = currentPath ? currentPath.split('/') : [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 bg-inner2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-inner3 rounded-md border border-border flex items-center justify-center text-text-d">
            {instance.icon ? <img src={instance.icon} alt="" /> : <Package size={28} />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-p leading-tight">{instance.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] bg-inner3 px-1.5 py-0.5 rounded text-text-s font-bold border border-border uppercase">{instance.version} · {instance.loader}</span>
              <span className="text-[10px] text-text-d font-medium">{status === 'ready' ? 'Ready to play' : stageLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button onClick={handlePlay} disabled={status !== 'ready'}
            className={`px-8 py-2.5 rounded-md font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-black/20 ${status === 'ready' ? 'bg-text-p text-inner hover:scale-[1.02]' : 'bg-inner3 text-text-d cursor-not-allowed'}`}>
            {status === 'ready'       && <><Play size={14} fill="currentColor" /> Play</>}
            {status === 'downloading' && <><Download size={14} className="animate-bounce" /> Downloading</>}
            {status === 'launching'   && <><Terminal size={14} /> Launching</>}
            {status === 'running'     && <><Square size={14} /> Running</>}
          </button>
          {status === 'downloading' && downloadProgress && (
            <div className="w-48 flex flex-col gap-1">
              <div className="h-1.5 bg-inner3 rounded-full overflow-hidden border border-border">
                <div className="h-full bg-text-p transition-all duration-150 rounded-full" style={{ width: `${downloadProgress.percent}%` }} />
              </div>
              <span className="text-[9px] text-text-d text-right">{downloadProgress.percent.toFixed(0)}% — {downloadProgress.file}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-end gap-6 px-8 pt-4 border-b border-border bg-inner">
        {[
          ...(instance.loader !== 'vanilla' ? [{ id: 'mods', icon: Package, label: 'Mods' }] : []),
          { id: 'files', icon: Folder, label: 'Files' },
          { id: 'logs', icon: FileText, label: 'Logs', badge: logs.length > 0 },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative flex items-center gap-2 ${activeTab === tab.id ? 'text-text-p' : 'text-text-d hover:text-text-s'}`}>
            <tab.icon size={14} />
            {tab.label}
            {tab.badge && activeTab !== tab.id && <span className="w-1.5 h-1.5 rounded-full bg-text-p" />}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-text-p" />}
          </button>
        ))}
        {activeTab === 'logs' && logs.length > 0 && (
          <button onClick={handleCopyLogs} className="ml-auto mb-3 flex items-center gap-1.5 px-2.5 py-1 bg-inner2 border border-border rounded text-[11px] font-bold text-text-s hover:text-text-p transition-colors">
            {copied ? <><Check size={12} className="text-green-400" /> Copied!</> : <><Copy size={12} /> Copy logs</>}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 scroll-hide">

        {activeTab === 'mods' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-hidden">
              <ModBrowser mcVersion={instance.version} loader={instance.loader}
                onInstall={async (mod) => {
                  appendLog(`Installing ${mod.name}...`, 'info');
                  try {
                    await invoke('install_mod', { instanceId: instance.id, modId: mod.id, source: mod.source, mcVersion: instance.version, loader: instance.loader });
                    appendLog(`${mod.name} installed!`, 'info');
                  } catch (err) { appendLog(`Failed to install ${mod.name}: ${err}`, 'error'); }
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="h-full flex flex-col gap-3">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={handleOpenFinder} className="px-3 py-1.5 bg-inner2 border border-border rounded text-xs font-bold text-text-s hover:text-text-p hover:bg-inner3 transition-colors flex items-center gap-1.5">
                <FolderOpen size={13} /> Open in Finder
              </button>
              <button onClick={() => setShowCreateFolder(v => !v)} className="px-3 py-1.5 bg-inner2 border border-border rounded text-xs font-bold text-text-s hover:text-text-p hover:bg-inner3 transition-colors flex items-center gap-1.5">
                <Plus size={13} /> New Folder
              </button>
              {currentPath && (
                <button onClick={() => { const p = currentPath.split('/'); p.pop(); setCurrentPath(p.join('/')); }}
                  className="px-3 py-1.5 bg-inner2 border border-border rounded text-xs font-bold text-text-s hover:text-text-p hover:bg-inner3 transition-colors flex items-center gap-1.5">
                  <ArrowLeft size={13} /> Back
                </button>
              )}
            </div>

            {showCreateFolder && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <input autoFocus type="text" value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                  placeholder="Folder name..."
                  className="flex-1 px-2.5 py-1.5 bg-inner2 border border-border rounded text-xs text-text-p outline-none focus:border-text-s" />
                <button onClick={handleCreateFolder} className="px-3 py-1.5 bg-text-p text-inner rounded text-xs font-bold">Create</button>
                <button onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }} className="px-2 py-1.5 text-text-s hover:text-text-p text-xs">Cancel</button>
              </div>
            )}

            {breadcrumb.length > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-text-d flex-shrink-0">
                <button onClick={() => setCurrentPath('')} className="hover:text-text-s transition-colors">root</button>
                {breadcrumb.map((seg, i) => (
                  <React.Fragment key={i}>
                    <span>/</span>
                    <button onClick={() => setCurrentPath(breadcrumb.slice(0, i + 1).join('/'))} className="hover:text-text-s transition-colors">{seg}</button>
                  </React.Fragment>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto scroll-hide">
              <Files className="w-full">
                {files.length === 0 && (
                  <div className="p-8 text-center text-text-d text-xs italic">This folder is empty.</div>
                )}
                {files.map((entry) => {
                  if (entry.is_dir) {
                    const children = subFiles[entry.path]; // undefined=not opened, null=loading, []=loaded
                    return (
                      <FolderItem key={entry.path} value={entry.path}>
                        <FolderTrigger onClick={() => handleFolderOpen(entry.path)} className="w-full">
                          {entry.name}
                        </FolderTrigger>
                        <FolderContent>
                          <SubFiles>
                            {children === undefined || children === null ? (
                              <span className="text-[11px] text-text-d pl-2 py-1 block">
                                {children === null ? 'Loading...' : ''}
                              </span>
                            ) : children.length === 0 ? (
                              <span className="text-[11px] text-text-d pl-2 py-1 block">Empty</span>
                            ) : (
                              children.map(child => {
                                if (child.is_dir) {
                                  const grandChildren = subFiles[child.path];
                                  return (
                                    <FolderItem key={child.path} value={child.path}>
                                      <FolderTrigger onClick={() => handleFolderOpen(child.path)} className="w-full">
                                        {child.name}
                                      </FolderTrigger>
                                      <FolderContent>
                                        <SubFiles>
                                          {grandChildren === undefined || grandChildren === null ? (
                                            <span className="text-[11px] text-text-d pl-2 py-1 block">
                                              {grandChildren === null ? 'Loading...' : ''}
                                            </span>
                                          ) : grandChildren.length === 0 ? (
                                            <span className="text-[11px] text-text-d pl-2 py-1 block">Empty</span>
                                          ) : (
                                            grandChildren.map(g => (
                                              <FileItem key={g.path} icon={fileIcon(g.name)}>
                                                <span className="flex-1 truncate">{g.name}</span>
                                                <span className="text-[10px] text-text-d ml-2 tabular-nums">{fmtSize(g.size)}</span>
                                              </FileItem>
                                            ))
                                          )}
                                        </SubFiles>
                                      </FolderContent>
                                    </FolderItem>
                                  );
                                }
                                return (
                                  <FileItem key={child.path} icon={fileIcon(child.name)}>
                                    <span className="flex-1 truncate">{child.name}</span>
                                    <span className="text-[10px] text-text-d ml-2 tabular-nums">{fmtSize(child.size)}</span>
                                  </FileItem>
                                );
                              })
                            )}
                          </SubFiles>
                        </FolderContent>
                      </FolderItem>
                    );
                  }
                  return (
                    <FileItem key={entry.path} icon={fileIcon(entry.name)}>
                      <span className="flex-1 truncate">{entry.name}</span>
                      <span className="text-[10px] text-text-d ml-2 tabular-nums">{fmtSize(entry.size)}</span>
                    </FileItem>
                  );
                })}
              </Files>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-inner2 border border-border rounded-md p-4 font-mono text-xs leading-relaxed min-h-full">
            {logs.length === 0 && <div className="text-text-d italic">No logs yet. Launch Minecraft to see output.</div>}
            {logs.map((log, i) => (
              <div key={i} className={`whitespace-pre-wrap ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-orange-300' : 'text-text-s'}`}>
                <span className="text-text-d mr-2 select-none opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                {log.line}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};