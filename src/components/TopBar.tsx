import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Moon, Sun, User, LogOut, Trash2, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useLauncherStore } from '../store/useLauncherStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { AuthScreen } from '../panels/AuthScreen';

export const TopBar: React.FC = () => {
  const { panelStack, forwardStack, popPanel, forwardPanel, pushPanel, auth, accounts, toggleTheme, theme, removeAccount, setActiveAccount, setAuth } = useLauncherStore();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  const handleRemoveAccount = (uuid: string) => {
    removeAccount(uuid);
  };

  const handleSwitchAccount = (uuid: string) => {
    setActiveAccount(uuid);
  };

  const handleLogout = () => {
    setAuth(null);
  };

  const handleAddAccount = () => {
    setShowAddAccount(true);
  };

  const handleMoveAccount = (uuid: string, direction: 'up' | 'down') => {
    const index = accounts.findIndex(a => a.uuid === uuid);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= accounts.length) return;
    reorderAccounts(index, newIndex);
  };

  const currentPanel = panelStack[panelStack.length - 1];
  const currentPanelId = currentPanel.id;

  const isActive = (id: string) => currentPanelId === id;

  return (
    <div className="relative z-50 col-span-2 flex items-center justify-between pl-[80px] pr-4 bg-outer/80 backdrop-blur-sm border-b border-border/10 select-none h-[54px]">
      {/* Drag region - non-interactive area */}
      <div data-tauri-drag-region className="absolute top-0 left-[80px] right-[200px] h-[54px]" />
      
      <div className="flex items-center gap-4 relative z-10">
        <div className="flex items-center gap-1">
          <motion.button 
            onClick={popPanel}
            disabled={panelStack.length <= 1}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className="p-1.5 rounded-md disabled:opacity-30 focus:outline-none cursor-pointer"
          >
            <ChevronLeft size={18} />
          </motion.button>
          <motion.button 
            onClick={forwardPanel}
            disabled={forwardStack.length === 0}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className="p-1.5 rounded-md disabled:opacity-30 focus:outline-none cursor-pointer"
          >
            <ChevronRight size={18} />
          </motion.button>
        </div>
        
        {/* Navigation buttons - left side */}
        <div className="flex items-center gap-1 ml-4">
          <motion.button 
            onClick={() => pushPanel('discover', undefined, 'topbar')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className={`px-3 py-1.5 text-sm font-medium ${isActive('discover') ? 'text-text-p' : 'text-text-s'}`}
          >
            Discover
          </motion.button>
          
          <motion.button 
            onClick={() => pushPanel('library', undefined, 'topbar')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className={`px-3 py-1.5 text-sm font-medium ${isActive('library') ? 'text-text-p' : 'text-text-s'}`}
          >
            Library
          </motion.button>
          
          <motion.button 
            onClick={() => pushPanel('skins', undefined, 'topbar')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className={`px-3 py-1.5 text-sm font-medium ${isActive('skins') ? 'text-text-p' : 'text-text-s'}`}
          >
            Skins
          </motion.button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {auth ? (
          <>
            <button
              onClick={() => setShowAccountSwitcher(true)}
              className="flex items-center gap-2 px-2 py-1 h-auto bg-inner2 border border-border rounded-md hover:bg-inner3 transition-colors"
            >
              <div className="w-6 h-6 bg-inner3 rounded-sm overflow-hidden relative">
                {auth.skin ? (
                  <>
                    {/* Base layer */}
                    <div 
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${auth.skin})`,
                        backgroundSize: '800% 800%',
                        backgroundPosition: '-100% -100%',
                        imageRendering: 'pixelated'
                      }}
                    />
                    {/* Overlay layer (hat/2nd layer) */}
                    <div 
                      className="absolute -inset-0.5"
                      style={{
                        backgroundImage: `url(${auth.skin})`,
                        backgroundSize: '800% 800%',
                        backgroundPosition: '-500% -100%',
                        imageRendering: 'pixelated'
                      }}
                    />
                  </>
                ) : (
                  <User size={14} className="m-auto mt-1 text-text-s" />
                )}
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold leading-tight">{auth.username}</span>
                <span className="text-[10px] text-text-s leading-tight uppercase tracking-wider">{auth.tier}</span>
              </div>
            </button>

            {/* Account Switcher Sidebar - slides in from right */}
            {showAccountSwitcher && createPortal(
              <AnimatePresence>
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="fixed top-0 right-0 bottom-0 w-80 bg-inner border-l border-border z-[99999] shadow-2xl"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-bold text-text-p">Accounts</h2>
                    <button 
                      onClick={() => setShowAccountSwitcher(false)}
                      className="p-2 hover:bg-inner2 rounded-lg transition-colors"
                    >
                      <X size={20} className="text-text-s" />
                    </button>
                  </div>

                  {/* Current Account */}
                  <div className="p-4 border-b border-border">
                    <p className="text-xs text-text-s uppercase mb-3">Currently using</p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-inner2 rounded overflow-hidden relative flex-shrink-0">
                        {auth.skin ? (
                          <>
                            <div 
                              className="absolute inset-0"
                              style={{
                                backgroundImage: `url(${auth.skin})`,
                                backgroundSize: '800% 800%',
                                backgroundPosition: '-100% -100%',
                                imageRendering: 'pixelated'
                              }}
                            />
                            <div 
                              className="absolute -inset-0.5"
                              style={{
                                backgroundImage: `url(${auth.skin})`,
                                backgroundSize: '800% 800%',
                                backgroundPosition: '-500% -100%',
                                imageRendering: 'pixelated'
                              }}
                            />
                          </>
                        ) : (
                          <User size={24} className="m-auto mt-2 text-text-s" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-text-p font-bold truncate">{auth.username}</p>
                        <p className="text-xs text-text-s">{auth.tier}</p>
                      </div>
                    </div>
                  </div>

                  {/* Other Accounts */}
                  {accounts.length > 0 && (
                    <div className="p-4 border-b border-border">
                      <p className="text-xs text-text-s uppercase mb-3">Other accounts</p>
                      <div className="space-y-2">
                        {accounts.filter(a => a.uuid !== auth.uuid).map((account) => (
                          <div 
                            key={account.uuid}
                            onClick={() => {
                              setActiveAccount(account.uuid);
                              setShowAccountSwitcher(false);
                            }}
                            className="flex items-center gap-3 p-2 bg-inner2 hover:bg-inner3 rounded-lg cursor-pointer transition-colors"
                          >
                            <div className="w-10 h-10 bg-inner3 rounded overflow-hidden relative flex-shrink-0">
                              {account.skin ? (
                                <>
                                  <div 
                                    className="absolute inset-0"
                                    style={{
                                      backgroundImage: `url(${account.skin})`,
                                      backgroundSize: '800% 800%',
                                      backgroundPosition: '-100% -100%',
                                      imageRendering: 'pixelated'
                                    }}
                                  />
                                  <div 
                                    className="absolute -inset-0.5"
                                    style={{
                                      backgroundImage: `url(${account.skin})`,
                                      backgroundSize: '800% 800%',
                                      backgroundPosition: '-500% -100%',
                                      imageRendering: 'pixelated'
                                    }}
                                  />
                                </>
                              ) : (
                                <User size={20} className="m-auto mt-1.5 text-text-s" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-text-p font-medium text-sm truncate">{account.username}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveAccount(account.uuid);
                              }}
                              className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors flex-shrink-0"
                            >
                              <Trash2 size={14} className="text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="p-4 space-y-2">
                    <button
                      onClick={() => {
                        setShowAccountSwitcher(false);
                        setShowAddAccount(true);
                      }}
                      className="w-full py-2.5 bg-text-p text-inner rounded-lg font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                    >
                      <Plus size={18} />
                      Add Account
                    </button>
                    
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowAccountSwitcher(false);
                      }}
                      className="w-full py-2.5 border border-border hover:bg-inner2 rounded-lg font-medium text-text-s hover:text-text-p transition-colors flex items-center justify-center gap-2"
                    >
                      <LogOut size={18} />
                      Sign Out
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>,
              document.body
            )}
          </>
        ) : (
          <div className="text-xs text-text-s">Not signed in</div>
        )}
        
        <motion.button 
          onClick={toggleTheme}
          whileHover={{ scale: 1.15, rotate: 15 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="p-2 rounded-md"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </motion.button>
      </div>

      {showAddAccount && <AuthScreen onClose={() => setShowAddAccount(false)} />}
    </div>
  );
};
