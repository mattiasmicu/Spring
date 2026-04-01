import React, { useState, useRef } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Upload, Check, RotateCcw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export const SkinsPanel: React.FC = () => {
  const { auth, addLog } = useLauncherStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="h-full overflow-y-auto p-8 scroll-hide">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-text-p">Skins</h1>
        <p className="text-text-s text-sm">Manage your Minecraft skin</p>
      </header>

      <div className="max-w-md">
        {/* Current Skin Preview - Player Head Only */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-text-p uppercase tracking-wider mb-3">Current Skin</h2>
          <div className="w-24 h-24 bg-inner2 border border-border rounded-xl flex items-center justify-center overflow-hidden">
            {auth?.skin ? (
              <img 
                src={auth.skin} 
                alt="Current skin" 
                className="w-[800%] h-[800%] object-cover object-top"
                style={{ 
                  objectPosition: 'top',
                  imageRendering: 'pixelated'
                }}
              />
            ) : (
              <div className="text-text-s text-xs">No skin</div>
            )}
          </div>
        </div>

        {/* Upload New Skin */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-text-p uppercase tracking-wider mb-3">Upload New Skin</h2>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-40 bg-inner2 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-text-s transition-colors"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="h-32 w-auto object-contain" />
            ) : (
              <>
                <Upload size={32} className="text-text-s mb-2" />
                <span className="text-text-s text-sm">Click to select PNG file</span>
                <span className="text-text-d text-xs mt-1">64x64 for classic skin</span>
              </>
            )}
          </div>

          {selectedFile && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-text-s text-sm">{selectedFile.name}</span>
              <button
                onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                className="text-text-d hover:text-text-s text-xs"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex-1 py-2 bg-text-p text-inner rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
          >
            {uploading ? (
              <RotateCcw size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            {uploading ? 'Uploading...' : 'Upload Skin'}
          </button>
          
          <button
            onClick={handleResetToDefault}
            disabled={!auth || uploading}
            className="px-4 py-2 bg-inner2 border border-border text-text-s rounded-lg text-sm font-bold hover:text-text-p disabled:opacity-50 transition-colors"
          >
            Reset
          </button>
        </div>

        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            message.includes('success') 
              ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {message}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-4 bg-inner2 border border-border rounded-lg">
          <h3 className="text-xs font-bold text-text-s uppercase mb-2">Requirements</h3>
          <ul className="text-text-d text-xs space-y-1">
            <li>• PNG format only</li>
            <li>• 64x64 pixels for modern skins (classic)</li>
            <li>• File size under 1MB</li>
          </ul>
        </div>
      </div>
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
