import React from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { InnerSurface } from './InnerSurface';
import { AuthScreen } from '../panels/AuthScreen';
import { useLauncherStore } from '../store/useLauncherStore';

export const Shell: React.FC = () => {
  const theme = useLauncherStore((state) => state.theme);
  const auth = useLauncherStore((state) => state.auth);

  if (!auth) {
    return (
      <div className={`w-screen h-screen bg-black overflow-hidden flex items-center justify-center ${theme}`}>
        <AuthScreen isFullScreen />
      </div>
    );
  }

  return (
    <div className={`w-screen h-screen bg-black overflow-hidden flex items-center justify-center ${theme}`}>
      <div className="w-full h-full bg-outer rounded-2xl overflow-hidden flex flex-col">
        <TopBar />
        <div className="flex flex-1 min-h-0 p-2 pt-0 gap-0">
          <Sidebar />
          <InnerSurface className="flex-1 h-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
};