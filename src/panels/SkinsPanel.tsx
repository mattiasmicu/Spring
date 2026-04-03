import React, { useEffect, useRef, useState } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Upload, Check, RotateCcw, Play, Pause, Hand, Palette } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Render, WalkingAnimation, RunningAnimation, IdleAnimation } from 'skin3d';
import { Button } from '../components/Button';
import { ToastContainer, useToasts } from '../components/Toast';

type AnimationType = 'idle' | 'walk' | 'run';

// 3D Skin Viewer Component with controls
const Skin3DViewer: React.FC<{ 
  skinUrl: string; 
  capeUrl?: string; 
  animation: AnimationType; 
  autoRotate: boolean;
  background: string;
  isCrouching: boolean;
  showElytra: boolean;
  nameTag?: string;
}> = ({ 
  skinUrl, 
  capeUrl, 
  animation,
  autoRotate,
  background,
  isCrouching,
  showElytra,
  nameTag
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<Render | null>(null);

  // Initialize viewer once - only when skin changes
  useEffect(() => {
    if (!canvasRef.current) return;

    const viewer = new Render({
      canvas: canvasRef.current,
      width: 320,
      height: 400,
      skin: skinUrl,
      zoom: 0.7,
      nameTag: nameTag || undefined
    });

    viewer.zoom = 0.7;
    viewer.controls.enableZoom = true;
    viewer.controls.enablePan = false;
    viewerRef.current = viewer;

    return () => {
      viewer.dispose();
    };
  }, [skinUrl]);

  // Update cape
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (capeUrl) {
      viewer.loadCape(capeUrl);
    }
  }, [capeUrl]);

  // Update autoRotate
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.autoRotate = autoRotate;
    viewer.controls.enableRotate = !autoRotate;
  }, [autoRotate]);

  // Update elytra visibility
  useEffect(() => {
    const viewer = viewerRef.current as any;
    if (!viewer) return;
    
    const updateElytra = async () => {
      if (showElytra) {
        await viewer.loadElytra(skinUrl);
      } else if (viewer.player?.elytra) {
        viewer.player.elytra.visible = false;
      }
    };
    updateElytra();
  }, [showElytra, skinUrl]);

  // Update nametag
  useEffect(() => {
    const viewer = viewerRef.current as any;
    if (!viewer) return;
    
    if (nameTag) {
      viewer.nameTag = nameTag;
    } else {
      viewer.nameTag = null;
    }
  }, [nameTag]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (background === 'transparent') {
      viewer.background = 'transparent';
    } else if (background === 'panorama') {
      viewer.loadPanorama('/panorama.png');
    } else {
      viewer.loadPanorama(background);
    }
  }, [background]);

  // Update animation or crouch
  useEffect(() => {
    const viewer = viewerRef.current as any;
    if (!viewer) return;

    const applyAnimation = async () => {
      if (isCrouching) {
        // Use CrouchAnimation with slow speed
        const { CrouchAnimation } = await import('skin3d');
        viewer.animation = new CrouchAnimation();
        viewer.animation.speed = 0.5;
      } else {
        switch (animation) {
          case 'walk':
            viewer.animation = new WalkingAnimation();
            viewer.animation.speed = 1;
            break;
          case 'run':
            viewer.animation = new RunningAnimation();
            viewer.animation.speed = 0.8;
            break;
          case 'idle':
            viewer.animation = new IdleAnimation();
            break;
        }
      }
    };
    applyAnimation();
  }, [animation, isCrouching]);

  return (
    <canvas 
      ref={canvasRef}
      className="w-full h-[320px] rounded-xl cursor-grab active:cursor-grabbing"
    />
  );
};

export const SkinsPanel: React.FC = () => {
  const { auth, addLog } = useLauncherStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 3D Viewer Controls
  const [animation, setAnimation] = useState<AnimationType>('idle');
  const [autoRotate, setAutoRotate] = useState(false);
  const [selectedCape, setSelectedCape] = useState<string | null>('none');
  const [isCrouching, setIsCrouching] = useState(false);
  const [showElytra, setShowElytra] = useState(false);
  const [nameTag, setNameTag] = useState<string>(auth?.username || '');
  const [background, setBackground] = useState<string>('panorama');
  // Track original state for change detection
  const [originalCape, setOriginalCape] = useState<string | null>('none');
  const [hasChanges, setHasChanges] = useState(false);
  const [showBackgroundDropdown, setShowBackgroundDropdown] = useState(false);
  const { toasts, addToast, removeToast } = useToasts();
  
  const backgroundOptions = [
    { value: 'transparent', label: 'Transparent' },
    { value: 'panorama', label: 'Panorama' },
    { value: 'default', label: 'Default' },
    { value: 'night', label: 'Night' },
    { value: 'sunset', label: 'Sunset' },
    { value: 'day', label: 'Day' },
  ];
  
  // Capes - fetch from backend
  const [capes, setCapes] = useState<Array<{id: string, name: string, url: string, data_url?: string}>>([
    { id: 'none', name: 'No Cape', url: '', data_url: undefined }
  ]);

  useEffect(() => {
    if (!auth) return;
    
    const fetchCapes = async () => {
      try {
        const token = auth?.access_token || auth?.token;
        console.log('Fetching capes, token exists:', !!token);
        const capeData = await invoke('get_capes', { accessToken: token }) as Array<{id: string, name: string, url: string, data_url?: string}>;
        console.log('Received capes:', capeData);
        setCapes(capeData);
        // Set original cape from profile
        const profile = await invoke('get_profile', { accessToken: token }) as any;
        if (profile?.capes?.[0]?.id) {
          setOriginalCape(profile.capes[0].id);
          setSelectedCape(profile.capes[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch capes:', err);
        addLog(`Failed to fetch capes: ${err}`, 'error');
      }
    };
    
    fetchCapes();
  }, [auth, addLog]);

  // Detect changes
  useEffect(() => {
    setHasChanges(selectedCape !== originalCape);
  }, [selectedCape, originalCape]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.png')) {
        setMessage('Please select a PNG file');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !auth) return;
    
    setUploading(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      await invoke('upload_skin', {
        accessToken: auth.access_token,
        skinData: base64,
        skinType: 'classic'
      });
      
      addLog('Skin uploaded successfully!', 'info');
      setMessage('Skin uploaded successfully!');
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err) {
      addLog(`Failed to upload skin: ${err}`, 'error');
      setMessage('Failed to upload skin');
    } finally {
      setUploading(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!auth) return;
    
    try {
      await invoke('reset_skin', { accessToken: auth.access_token });
      addLog('Skin reset to default', 'info');
      setMessage('Skin reset to default');
    } catch (err) {
      addLog(`Failed to reset skin: ${err}`, 'error');
      setMessage('Failed to reset skin');
    }
  };

  const handleApplyChanges = async () => {
    if (!auth) return;
    
    try {
      const token = auth?.access_token || auth?.token;
      await invoke('equip_cape', { 
        accessToken: token, 
        capeId: selectedCape === 'none' ? null : selectedCape 
      });
      setOriginalCape(selectedCape);
      setHasChanges(false);
      addLog('Cape updated successfully!', 'info');
      addToast('Cape updated successfully!', 'success');
      setMessage('Cape updated successfully!');
    } catch (err) {
      addLog(`Failed to update cape: ${err}`, 'error');
      addToast(`Failed to update cape: ${err}`, 'error');
      setMessage('Failed to update cape');
    }
  };

  const handleCancelChanges = () => {
    setSelectedCape(originalCape);
    setHasChanges(false);
  };

  const handleIgnoreChanges = () => {
    setHasChanges(false);
  };

  const activeCapeUrl = selectedCape && selectedCape !== 'none' 
    ? capes.find(c => c.id === selectedCape)?.url 
    : undefined;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 scroll-hide">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-text-p">Skins</h1>
          <p className="text-text-s text-sm">Manage your Minecraft skin and capes</p>
        </header>

        <div className="max-w-6xl">
          {/* Two columns: Avatar left, Capes+Upload right */}
          <div className="grid grid-cols-[300px_1fr] gap-6">
            {/* Left: 3D Skin Preview */}
            <div className="bg-inner2 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-text-p">Preview</h2>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant={autoRotate ? 'default' : 'outline'}
                    onClick={() => setAutoRotate(!autoRotate)}
                    className="p-2"
                  >
                    {autoRotate ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                  </Button>
                  <Button
                    variant={!autoRotate ? 'default' : 'outline'}
                    onClick={() => setAutoRotate(false)}
                    className="p-2"
                  >
                    <Hand size={18} />
                  </Button>
                  <div className="relative">
                    <Button 
                      variant="outline" 
                      className="p-2"
                      onClick={() => setShowBackgroundDropdown(!showBackgroundDropdown)}
                    >
                      <Palette size={18} />
                    </Button>
                    
                    {showBackgroundDropdown && (
                      <div className="absolute top-full right-0 mt-1 w-32 bg-inner2 border border-border rounded-lg shadow-lg z-50">
                        {backgroundOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setBackground(option.value);
                              setShowBackgroundDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-inner transition-colors first:rounded-t-lg last:rounded-b-lg ${
                              background === option.value ? 'text-text-p' : 'text-text-s'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-center mb-3">
                {auth?.skin ? (
                  <div className="relative">
                    <Skin3DViewer 
                      skinUrl={auth.skin} 
                      capeUrl={activeCapeUrl} 
                      animation={animation} 
                      autoRotate={autoRotate} 
                      background={background}
                      isCrouching={isCrouching}
                      showElytra={showElytra}
                      nameTag={nameTag || undefined}
                    />
                    {!autoRotate && <p className="text-center text-text-d text-xs mt-1">Drag to rotate</p>}
                  </div>
                ) : <div className="w-48 h-64 flex items-center justify-center text-text-s">No skin</div>}
              </div>

              <div className="flex items-center justify-center gap-2">
                <Button variant={animation === 'idle' ? 'default' : 'outline'} onClick={() => setAnimation('idle')} className="text-xs px-3 py-1.5">Idle</Button>
                <Button variant={animation === 'walk' ? 'default' : 'outline'} onClick={() => setAnimation('walk')} className="text-xs px-3 py-1.5">Walk</Button>
                <Button variant={animation === 'run' ? 'default' : 'outline'} onClick={() => setAnimation('run')} className="text-xs px-3 py-1.5">Run</Button>
              </div>

              <div className="flex items-center justify-center gap-4 mt-3">
                {/* Custom Toggle - Elytra */}
                <div 
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => setShowElytra(!showElytra)}
                >
                  <div className={`relative w-10 h-5 rounded-full transition-colors ${showElytra ? 'bg-text-p' : 'bg-inner3'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-inner rounded-full transition-transform ${showElytra ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-xs text-text-s">Elytra</span>
                </div>
                
                {/* Custom Toggle - Crouch */}
                <div 
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => setIsCrouching(!isCrouching)}
                >
                  <div className={`relative w-10 h-5 rounded-full transition-colors ${isCrouching ? 'bg-text-p' : 'bg-inner3'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-inner rounded-full transition-transform ${isCrouching ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-xs text-text-s">Crouch</span>
                </div>
              </div>
              
              {/* Name Tag Input */}
              <div className="mt-3 px-4">
                <input
                  type="text"
                  value={nameTag}
                  onChange={(e) => setNameTag(e.target.value)}
                  placeholder="Enter name tag..."
                  className="w-full px-3 py-1.5 bg-inner border border-border rounded-lg text-xs text-text-p placeholder:text-text-d focus:outline-none focus:border-text-s"
                />
              </div>
            </div>

            {/* Right: Capes on top, Upload below */}
            <div className="space-y-4 flex flex-col">
              {/* Capes */}
              <div className="bg-inner2 border border-border rounded-xl p-4 flex-1">
                <h2 className="text-sm font-bold text-text-p mb-3">Capes</h2>
                <div className="grid grid-cols-4 gap-3">
                  {capes.map((cape) => (
                    <Button
                      key={cape.id}
                      variant={selectedCape === cape.id ? 'default' : 'outline'}
                      onClick={() => setSelectedCape(cape.id)}
                      className="p-3 h-auto flex-col gap-1"
                    >
                      {cape.data_url ? (
                        <img src={cape.data_url} alt={cape.name} className="w-full h-12 object-contain" />
                      ) : (
                        <span className="text-text-d text-[10px]">None</span>
                      )}
                      <span className="text-xs">{cape.name}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Upload */}
              <div className="bg-inner2 border border-border rounded-xl p-4">
                <h2 className="text-sm font-bold text-text-p mb-3">Upload New Skin</h2>
                
                <input ref={fileInputRef} type="file" accept="image/png" onChange={handleFileSelect} className="hidden" />
                
                <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 bg-inner border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-text-s transition-colors mb-3">
                  {previewUrl ? <img src={previewUrl} alt="Preview" className="h-28 w-auto object-contain rounded" /> : <><Upload size={32} className="text-text-s mb-2" /><span className="text-text-s text-sm">Click to select PNG file</span><span className="text-text-d text-xs">64x64 for classic skin</span></>}
                </div>

                {selectedFile && <div className="mb-3 p-2 bg-inner rounded flex items-center justify-between"><span className="text-text-s text-sm truncate">{selectedFile.name}</span><button onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="text-text-d hover:text-red-400 text-xs">Clear</button></div>}

                <div className="flex gap-3">
                  <Button onClick={handleUpload} disabled={!selectedFile || uploading} className="flex-1">
                    {uploading ? <RotateCcw size={14} className="animate-spin" /> : <Check size={14} />}
                    {uploading ? 'Uploading...' : 'Upload Skin'}
                  </Button>
                  <Button variant="outline" onClick={handleResetToDefault} disabled={!auth || uploading}>Reset</Button>
                </div>
              </div>

              {message && <div className={`p-3 rounded-lg text-sm ${message.includes('success') ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>{message}</div>}
            </div>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Floating Changes Bar */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-inner2 border border-border rounded-xl shadow-2xl px-6 py-3 flex items-center gap-6">
          <span className="text-sm text-text-s">You have unsaved changes</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleIgnoreChanges} className="text-xs hover:opacity-80">
              Ignore
            </Button>
            <Button variant="outline" onClick={handleCancelChanges} className="text-xs hover:opacity-80">
              Cancel
            </Button>
            <Button onClick={handleApplyChanges} className="text-xs hover:opacity-80">
              Apply Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const InstancesPanel: React.FC = () => (
  <div className="p-8">
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-xl font-bold">Instances</h1>
      <button className="px-4 py-2 bg-text-p text-inner rounded-md text-xs font-bold hover:opacity-90">
        + New Instance
      </button>
    </div>
    <div className="text-text-s text-sm">List of instances will appear here.</div>
  </div>
);

export const InstanceDetailPanel: React.FC<{ id: string }> = ({ id }) => (
  <div className="p-8">
    <h1 className="text-xl font-bold mb-4">Instance Detail: {id}</h1>
    <div className="text-text-s text-sm">Details, mods, files, and logs for this instance.</div>
  </div>
);

export const ModsPanel: React.FC = () => (
  <div className="p-8">
    <h1 className="text-xl font-bold mb-4">Mods</h1>
    <div className="text-text-s text-sm">Search and install mods from Modrinth.</div>
  </div>
);

export const SettingsPanel: React.FC = () => (
  <div className="p-8">
    <h1 className="text-xl font-bold mb-4">Settings</h1>
    <div className="text-text-s text-sm">Launcher settings and account management.</div>
  </div>
);
