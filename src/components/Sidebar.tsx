import React, { useState } from 'react';
import { Home, Settings as SettingsIcon, Plus, Trash2, Play } from 'lucide-react';
import { useLauncherStore } from '../store/useLauncherStore';
import { InstanceCreationModal } from './InstanceCreationModal';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { DropdownMenuItem, DropdownMenuSeparator } from './DropdownMenu';
import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip';

export const Sidebar: React.FC = () => {
  const { panelStack, pushPanel, instances, setInstances } = useLauncherStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; instanceId: string; instanceName: string } | null>(null);

  const isActive = (id: string) => panelStack[panelStack.length - 1].id === id;
  const currentPanel = panelStack[panelStack.length - 1];
  const activeInstanceId = currentPanel.id === 'instances' || currentPanel.id === 'instanceDetail'
    ? currentPanel.props?.instanceId || currentPanel.props?.id
    : null;

  const handleInstanceClick = (instanceId: string) => {
    pushPanel('instanceDetail', { id: instanceId });
  };

  const handleDeleteInstance = async (instanceId: string) => {
    try {
      await invoke('delete_instance', { id: instanceId });
      const updated = await invoke<any[]>('list_instances');
      setInstances(updated ?? []);
    } catch (err) {
      console.error('Failed to delete instance:', err);
    }
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, instanceId: string, instanceName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, instanceId, instanceName });
  };

  const handleContextMenuAction = (action: 'open' | 'delete') => {
    if (!contextMenu) return;
    if (action === 'open') {
      handleInstanceClick(contextMenu.instanceId);
    } else {
      handleDeleteInstance(contextMenu.instanceId);
    }
    setContextMenu(null);
  };

  return (
    <>
      <div data-tauri-drag-region className="flex flex-col items-center py-4 bg-outer w-[60px] shrink-0">
        <motion.button
          onClick={() => pushPanel('home')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="relative group mb-4"
        >
          <div className={`w-6 h-6 flex items-center justify-center ${isActive('home') ? 'text-text-p' : 'text-text-s'}`}>
            <Home size={20} />
          </div>
          <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full transition-all ${isActive('home') ? 'bg-blue-500' : 'bg-transparent'}`} />
        </motion.button>

        <div className="w-8 h-px bg-border/30 mb-4" />

        <div className="flex flex-col gap-3 flex-1 overflow-y-auto py-2 w-full px-2">
          {instances.map((instance) => (
            <Tooltip key={instance.id}>
              <TooltipTrigger>
                <button
                  onClick={() => handleInstanceClick(instance.id)}
                  onContextMenu={(e) => handleContextMenu(e, instance.id, instance.name)}
                  className="relative w-full"
                >
                  <div className={`w-full aspect-square rounded-xl flex items-center justify-center text-lg overflow-hidden ${
                    activeInstanceId === instance.id
                      ? 'bg-inner2 text-text-p ring-2 ring-text-p/50'
                      : 'bg-inner3 text-text-s'
                  }`}>
                    {instance.icon && instance.icon.startsWith('/') ? (
                      <img
                        src={convertFileSrc(instance.icon)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span>{instance.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  {activeInstanceId === instance.id && (
                    <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-text-p" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p>{instance.name}</p>
              </TooltipContent>
            </Tooltip>
          ))}

          <motion.button
            onClick={() => setShowCreateModal(true)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className="relative w-full"
          >
            <div className="w-full aspect-square rounded-xl flex items-center justify-center bg-inner3/50 text-text-s border border-dashed border-border">
              <Plus size={20} />
            </div>
          </motion.button>
        </div>

        <div className="w-8 h-px bg-border/30 mb-4" />

        <motion.button
          onClick={() => pushPanel('settings')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className={`relative group ${isActive('settings') ? 'text-text-p' : 'text-text-s'}`}
          title="Settings"
        >
          <SettingsIcon size={20} />
          <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full transition-all ${isActive('settings') ? 'bg-orange-500' : 'bg-transparent'}`} />
        </motion.button>
      </div>

      <InstanceCreationModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />

      <AnimatePresence>
        {contextMenu && (
          <div
            className="fixed inset-0 z-[99999]"
            onClick={() => setContextMenu(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="fixed bg-inner border border-border rounded-xl shadow-xl overflow-hidden w-56 py-1 z-[99999]"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs text-text-s font-medium uppercase tracking-wider">{contextMenu.instanceName}</p>
              </div>
              <DropdownMenuItem onClick={() => handleContextMenuAction('open')} icon={<Play size={14} />}>
                Open
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleContextMenuAction('delete')} variant="destructive" icon={<Trash2 size={14} />}>
                Delete
              </DropdownMenuItem>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};