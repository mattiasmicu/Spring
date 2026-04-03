import React, { useEffect, useState } from 'react';
import { Shell } from './components/Shell';
import { SplashScreen } from './components/SplashScreen';
import { useLauncherStore } from './store/useLauncherStore';
import { invoke } from '@tauri-apps/api/core';

export const App: React.FC = () => {
  const { saveSettings, setInstances, theme } = useLauncherStore();
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string>('Initializing...');
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);

  useEffect(() => {
    const loadApp = async () => {
      setStatus('Loading settings...');
      const settingsRes = await invoke('get_settings').catch(() => null);
      if (settingsRes) saveSettings(settingsRes as any);
      
      setStatus('Loading instances...');
      const instancesRes = await invoke('list_instances').catch(() => null);
      if (instancesRes) setInstances(instancesRes as any);
      
      setStatus('Checking for updates...');
      const updateRes = await invoke('check_update').catch(() => null) as string | null;
      if (updateRes) {
        setUpdateVersion(updateRes);
        setStatus(`Update available: v${updateRes}`);
      } else {
        setStatus('Up to date');
      }
      
      await new Promise(r => setTimeout(r, 500));
      setIsLoading(false);
    };

    loadApp();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  if (isLoading) {
    return <SplashScreen status={status} updateVersion={updateVersion} />;
  }

  return <Shell />;
};
