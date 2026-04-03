import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLauncherStore } from '../store/useLauncherStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Download, Monitor, ShieldCheck, X } from 'lucide-react';
import { Button } from '../components/Button';
import { Loader } from '../components/Loader';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const AuthScreen: React.FC<{ isFullScreen?: boolean; onClose?: () => void }> = ({ isFullScreen = false, onClose }) => {
  const [step, setStep] = useState(1);
  const { setAuth, saveSettings, setInstances } = useLauncherStore();

  const [javaProgress, setJavaProgress] = useState({ stage: 'Idle', percent: 0 });
  const [isDownloading, setIsDownloading] = useState(false);

  const [authStatus, setAuthStatus] = useState<'idle' | 'authenticating' | 'error'>('idle');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authWindowClosed, setAuthWindowClosed] = useState(false);

  const [javaError, setJavaError] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);

  const [showOffline, setShowOffline] = useState(false);
  const [offlineUsername, setOfflineUsername] = useState('');

  useEffect(() => {
    const unlistenProgress = listen('java-progress', (event: any) => {
      setJavaProgress(event.payload);
    });

    const unlistenStatus = listen('auth-status', (event: any) => {
      console.log('Auth status changed:', event.payload);
      setAuthStatus(event.payload === 'authenticating' ? 'authenticating' : 'idle');
    });

    // Auth succeeded in background
    const unlistenSuccess = listen('auth-success', (event: any) => {
      setAuth(event.payload);
      if (isFullScreen) {
        setStep(2);
      } else {
        onClose?.();
      }
    });

    // Auth failed in background
    const unlistenError = listen('auth-error', (event: any) => {
      setLoginError(typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload));
      setAuthStatus('error');
    });

    // Auth window closed
    const unlistenWindowClosed = listen('auth-window-closed', () => {
      setAuthWindowClosed(true);
    });

    return () => {
      unlistenProgress.then(f => f());
      unlistenStatus.then(f => f());
      unlistenSuccess.then(f => f());
      unlistenError.then(f => f());
      unlistenWindowClosed.then(f => f());
    };
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    setAuthStatus('authenticating');
    setShowOffline(false);
    setAuthWindowClosed(false);

    try {
      // Start OAuth flow - opens browser and starts local redirect server
      await invoke('start_microsoft_auth');
      // Result comes back via auth-success / auth-error events
    } catch (err: any) {
      setLoginError(typeof err === 'string' ? err : JSON.stringify(err));
      setAuthStatus('error');
    }
  };

  const handleCancelAuth = async () => {
    setAuthStatus('idle');
    setLoginError(null);
    setAuthWindowClosed(false);
    await invoke('cancel_microsoft_auth').catch(() => {});
  };

  const handleOfflineLogin = () => {
    const name = offlineUsername.trim();
    if (!name || name.length < 2) return;
    setAuth({
      uuid: `offline-${name.toLowerCase()}`,
      username: name,
      token: 'offline',
      refresh: 'offline',
      tier: 'offline' as any,
    });
    if (isFullScreen) {
      setStep(2);
    } else {
      onClose?.();
    }
  };

  const handleJava = async () => {
    setIsDownloading(true);
    setJavaError(null);
    try {
      // Detect OS and arch
      const platform = await invoke<{os: string, arch: string}>('get_platform_info');
      const path = await invoke('download_java', { os: platform.os, arch: platform.arch });
      saveSettings({ javaPath: path as string });
      setStep(3);
    } catch (err: any) {
      console.error(err);
      setJavaError(typeof err === 'string' ? err : 'Failed to download Java. You can skip and configure manually later.');
    }
    setIsDownloading(false);
  };

  const handleFinish = async () => {
    setFinishError(null);
    try {
      const inst = await invoke('create_instance', { name: 'My First World', version: '1.20.1', loader: 'vanilla' });
      setInstances([inst as any]);
    } catch (err: any) {
      setFinishError(typeof err === 'string' ? err : 'Failed to create instance');
    }
  };

  const handleImportLauncher = async (launcher: string) => {
    setFinishError(null);
    try {
      // TODO: Implement actual import logic for each launcher
      console.log(`Importing from ${launcher}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err: any) {
      setFinishError(typeof err === 'string' ? err : `Failed to import from ${launcher}`);
    }
  };

  // FULL SCREEN MODE
  if (isFullScreen) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <div className="w-40 h-40 -mb-2 mx-auto">
                  <img src="/Spring-orange.png" alt="Spring" className="w-full h-full object-contain" />
                </div>
                <h1 className="text-3xl font-bold mb-3 text-center">Welcome to Spring</h1>
                <p className="text-text-s text-center mb-8">Sign in with your Microsoft account to get started.</p>

                <AnimatePresence mode="wait">
                  {showOffline ? (
                    <motion.div key="offline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Username"
                        value={offlineUsername}
                        onChange={e => setOfflineUsername(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleOfflineLogin()}
                        maxLength={16}
                        className="w-full px-4 py-3 bg-inner border border-border rounded-xl text-sm text-text-p placeholder:text-text-d outline-none focus:border-text-p transition-colors"
                      />
                      <Button onClick={handleOfflineLogin} disabled={offlineUsername.trim().length < 2} className="w-full">
                        Continue Offline
                      </Button>
                      <Button onClick={() => setShowOffline(false)} variant="ghost" className="w-full">← Back</Button>
                    </motion.div>
                  ) : authStatus === 'idle' || authStatus === 'error' ? (
                    <motion.div key="buttons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                      {loginError && <p className="text-red-400 text-xs bg-red-400/10 rounded-xl p-3 text-center">{loginError}</p>}
                      <Button onClick={handleLogin} variant="outline" className="w-full">
                        Sign in with Microsoft
                        <svg className="w-5 h-5 ml-2" viewBox="0 0 21 21">
                          <rect x="0" y="0" width="10" height="10" fill="#f25022"/>
                          <rect x="11" y="0" width="10" height="10" fill="#7fba00"/>
                          <rect x="0" y="11" width="10" height="10" fill="#00a4ef"/>
                          <rect x="11" y="11" width="10" height="10" fill="#ffb900"/>
                        </svg>
                      </Button>
                      <Button onClick={() => setShowOffline(true)} variant="outline" className="w-full">Play offline</Button>
                    </motion.div>
                  ) : authStatus === 'authenticating' ? (
                    <motion.div key="authing" className="text-center py-8 space-y-4">
                      <div className="flex justify-center">
                        <Loader size={80} color="orange" />
                      </div>
                      <p className="text-text-s">Signing in with Microsoft...</p>
                      {authWindowClosed ? (
                        <div className="space-y-3">
                          <p className="text-text-d text-xs">Login window was closed</p>
                          <Button onClick={handleLogin} variant="outline" className="w-full">
                            Reopen Login Window
                          </Button>
                          <Button onClick={handleCancelAuth} variant="ghost" className="w-full text-xs">Cancel</Button>
                        </div>
                      ) : (
                        <>
                          <p className="text-text-d text-xs">Complete the sign-in in the popup window</p>
                          <Button onClick={handleCancelAuth} variant="ghost" className="w-full text-xs">Cancel</Button>
                        </>
                      )}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="w-16 h-16 bg-inner rounded-2xl flex items-center justify-center mb-8 mx-auto">
                  <Monitor size={32} className="text-text-p" />
                </div>
                <h1 className="text-3xl font-bold mb-3 text-center">Setting up Java</h1>
                <p className="text-text-s text-center mb-8">Minecraft requires Java 21 to run.</p>
                {javaError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs text-center">
                    {javaError}
                  </div>
                )}
                {isDownloading ? (
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs text-text-s px-1">
                      <span>{javaProgress.stage}...</span>
                      <span>{Math.round(javaProgress.percent)}%</span>
                    </div>
                    <div className="w-full h-2 bg-inner rounded-full overflow-hidden">
                      <div className="h-full bg-text-p transition-all" style={{ width: `${javaProgress.percent}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Button onClick={handleJava} className="w-full"><Download size={16} className="mr-2" /> Download Java 21</Button>
                    <Button onClick={() => setStep(3)} variant="ghost" className="w-full text-xs">Skip for now</Button>
                  </div>
                )}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="w-16 h-16 bg-inner rounded-2xl flex items-center justify-center mb-8 mx-auto">
                  <ShieldCheck size={32} className="text-text-p" />
                </div>
                <h1 className="text-3xl font-bold mb-3 text-center">You're all set!</h1>
                <p className="text-text-s text-center mb-8">Choose how to get started.</p>
                {finishError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs text-center">
                    {finishError}
                  </div>
                )}
                
                <div className="space-y-3">
                  <Button onClick={handleFinish} className="w-full">
                    <Check size={16} className="mr-2" /> Create Fresh Instance
                  </Button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-black text-text-s">or import from</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => handleImportLauncher('minecraft')} variant="outline" className="text-xs py-2">
                      Minecraft Launcher
                    </Button>
                    <Button onClick={() => handleImportLauncher('prism')} variant="outline" className="text-xs py-2">
                      Prism Launcher
                    </Button>
                    <Button onClick={() => handleImportLauncher('modrinth')} variant="outline" className="text-xs py-2">
                      Modrinth
                    </Button>
                    <Button onClick={() => handleImportLauncher('lunar')} variant="outline" className="text-xs py-2">
                      Lunar Client
                    </Button>
                    <Button onClick={() => handleImportLauncher('feather')} variant="outline" className="text-xs py-2">
                      Feather Client
                    </Button>
                    <Button onClick={() => handleImportLauncher('atlauncher')} variant="outline" className="text-xs py-2">
                      ATLauncher
                    </Button>
                  </div>
                  
                  <Button onClick={() => handleImportLauncher('browse')} variant="ghost" className="w-full text-xs text-text-s">
                    Browse for instances folder...
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-center gap-2 mt-12">
            {[1, 2, 3].map(s => (
              <div key={s} className={`w-2 h-2 rounded-full transition-all ${s === step ? 'bg-text-p w-6' : s < step ? 'bg-text-s' : 'bg-inner'}`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // MODAL MODE - for adding new accounts with close button
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center overflow-y-auto">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-inner border border-border rounded-shell overflow-hidden shadow-2xl relative my-auto">
        {onClose && <Button onClick={onClose} variant="ghost" className="absolute top-4 right-4 p-2 z-10"><X size={20} /></Button>}
        <div className="p-8">
          <div className="w-24 h-24 mb-1 mx-auto">
            <img src="/Spring-orange.png" alt="Spring" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-bold mb-2">Add a New Account</h1>
          <p className="text-text-s text-sm mb-6">Sign in with Microsoft to add another account.</p>

          <AnimatePresence mode="wait">
            {showOffline ? (
              <motion.div key="offline" layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="space-y-3">
                <input autoFocus type="text" placeholder="Username" value={offlineUsername} onChange={e => setOfflineUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleOfflineLogin()} maxLength={16} className="w-full px-3 py-2.5 bg-inner2 border border-border rounded-md text-sm text-text-p placeholder:text-text-d outline-none focus:border-text-s transition-colors" />
                <Button onClick={handleOfflineLogin} disabled={offlineUsername.trim().length < 2} className="w-full">Add Offline Account</Button>
                <Button onClick={() => setShowOffline(false)} variant="ghost" className="w-full">← Back</Button>
              </motion.div>
            ) : authStatus === 'idle' || authStatus === 'error' ? (
              <motion.div key="buttons" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {loginError && <p className="text-red-400 text-xs bg-red-400/10 rounded-md p-3">{loginError}</p>}
                <Button onClick={handleLogin} variant="outline" className="w-full">
                  Sign in with Microsoft
                  <svg className="w-5 h-5 ml-2" viewBox="0 0 21 21">
                    <rect x="0" y="0" width="10" height="10" fill="#f25022"/>
                    <rect x="11" y="0" width="10" height="10" fill="#7fba00"/>
                    <rect x="0" y="11" width="10" height="10" fill="#00a4ef"/>
                    <rect x="11" y="11" width="10" height="10" fill="#ffb900"/>
                  </svg>
                </Button>
                <Button onClick={() => setShowOffline(true)} variant="outline" className="w-full">Add offline account</Button>
              </motion.div>
            ) : authStatus === 'authenticating' ? (
              <motion.div key="authing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="text-center py-6 space-y-4">
                <div className="flex justify-center">
                  <Loader size={72} color="orange" />
                </div>
                <p className="text-text-s text-sm">Signing in with Microsoft...</p>
                {authWindowClosed ? (
                  <div className="space-y-3">
                    <p className="text-text-d text-xs">Login window was closed</p>
                    <Button onClick={handleLogin} variant="outline" className="w-full text-sm">
                      Reopen Login Window
                    </Button>
                    <Button onClick={handleCancelAuth} variant="ghost" className="w-full text-xs">Cancel</Button>
                  </div>
                ) : (
                  <>
                    <p className="text-text-d text-xs">Complete the sign-in in the popup window</p>
                    <Button onClick={handleCancelAuth} variant="ghost" className="w-full text-xs">Cancel</Button>
                  </>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};