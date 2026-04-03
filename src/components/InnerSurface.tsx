import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLauncherStore } from '../store/useLauncherStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import { HomePanel } from '../panels/HomePanel';
import { DiscoverPanel } from '../panels/DiscoverPanel';
import { InstanceDetailPanel } from '../panels/InstanceDetailPanel';
import { ModsPanel } from '../panels/ModsPanel';
import { SkinsPanel } from '../panels/SkinsPanel';
import { SettingsPanel } from '../panels/SettingsPanel';
import { AuthScreen } from '../panels/AuthScreen';

const LibraryPanel: React.FC = () => {
  const { instances, pushPanel } = useLauncherStore();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-text-p mb-6">Library</h1>
      <div className="grid grid-cols-3 gap-4">
        {instances.map(instance => (
          <button
            key={instance.id}
            onClick={() => pushPanel('instanceDetail', { id: instance.id })}
            className="p-4 bg-inner2 border border-border rounded-xl hover:border-text-s transition-colors text-left"
          >
            <div className="w-12 h-12 bg-inner3 rounded-lg flex items-center justify-center text-2xl mb-3 overflow-hidden">
              {instance.icon && instance.icon.startsWith('/') ? (
                <motion.img
                  src={convertFileSrc(instance.icon)}
                  alt=""
                  className="w-full h-full object-cover rounded-lg"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <motion.span
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  {instance.name.charAt(0).toUpperCase()}
                </motion.span>
              )}
            </div>
            <p className="font-bold text-text-p">{instance.name}</p>
            <p className="text-xs text-text-s">{instance.version} · {instance.loader}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

const panels: Record<string, React.FC<any>> = {
  home: HomePanel,
  discover: DiscoverPanel,
  instances: InstanceDetailPanel,
  instanceDetail: InstanceDetailPanel,
  library: LibraryPanel,
  mods: ModsPanel,
  skins: SkinsPanel,
  settings: SettingsPanel,
};

export const InnerSurface: React.FC<{ className?: string }> = ({ className }) => {
  const { panelStack, auth } = useLauncherStore();
  const currentPanel = panelStack[panelStack.length - 1];

  const isTopbarNavigation = currentPanel?.source === 'topbar';

  const initialProps = isTopbarNavigation
    ? { x: '100%', opacity: 0 }
    : { y: '100%', opacity: 0 };

  const exitProps = isTopbarNavigation
    ? { x: '100%', opacity: 0 }
    : { y: '100%', opacity: 0 };

  return (
    <div className={`bg-inner overflow-hidden relative ${className ?? ''}`}>
      {!auth && <AuthScreen isFullScreen />}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={currentPanel.id + (currentPanel.props?.id || '')}
          initial={initialProps}
          animate={{ x: 0, y: 0, opacity: 1 }}
          exit={exitProps}
          transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
          className="absolute inset-0 overflow-hidden"
        >
          {React.createElement(panels[currentPanel.id] || (() => <div>Not Found: {currentPanel.id}</div>), currentPanel.props)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};