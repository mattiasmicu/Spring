import React, { useState, useEffect } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Loader } from '../components/Loader';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const AddAccountPanel: React.FC = () => {
  const { popPanel, addAccount } = useLauncherStore();

  const [authStatus, setAuthStatus] = useState<'idle' | 'authenticating' | 'error'>('idle');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [showOffline, setShowOffline] = useState(false);
  const [offlineUsername, setOfflineUsername] = useState('');

  useEffect(() => {
    const unlistenSuccess = listen('auth-success', (event: any) => {
      addAccount(event.payload);
      popPanel();
    });

    const unlistenError = listen('auth-error', (event: any) => {
      setLoginError(typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload));
      setAuthStatus('error');
    });

    return () => {
      unlistenSuccess.then(f => f());
      unlistenError.then(f => f());
    };
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    setAuthStatus('authenticating');
    setShowOffline(false);

    try {
      // Start OAuth flow - opens browser and starts local redirect server
      await invoke('start_microsoft_auth');
      // Result comes back via auth-success / auth-error events
    } catch (err: any) {
      setLoginError(typeof err === 'string' ? err : JSON.stringify(err));
      setAuthStatus('error');
    }
  };

  const handleOfflineLogin = () => {
    const name = offlineUsername.trim();
    if (!name || name.length < 2) return;
    addAccount({
      uuid: `offline-${name.toLowerCase()}`,
      username: name,
      token: 'offline',
      refresh: 'offline',
      tier: 'offline' as any,
    });
    popPanel();
  };

  const handleCancel = () => {
    setAuthStatus('idle');
    setLoginError(null);
    invoke('cancel_microsoft_auth').catch(() => {});
    popPanel();
  };

  return (
    <div className="h-full flex flex-col p-8 overflow-y-auto scroll-hide">
      <button 
        onClick={handleCancel}
        className="flex items-center gap-2 text-text-s hover:text-text-p transition-colors mb-8 w-fit"
      >
        <ArrowLeft size={18} />
        <span>Back</span>
      </button>

      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        <div className="w-16 h-16 bg-inner2 rounded-2xl flex items-center justify-center mb-6 text-text-p">
          <Plus size={32} />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-center">Add a New Account</h1>
        <p className="text-text-s text-sm mb-8 text-center">Sign in with Microsoft to add another account to Spring.</p>

        {showOffline ? (
          <div className="w-full space-y-4">
            <input
              autoFocus
              type="text"
              placeholder="Username"
              value={offlineUsername}
              onChange={e => setOfflineUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleOfflineLogin()}
              maxLength={16}
              className="w-full px-4 py-3 bg-inner2 border border-border rounded-xl text-sm text-text-p placeholder:text-text-d outline-none focus:border-text-p transition-colors"
            />
            <Button
              onClick={handleOfflineLogin}
              disabled={offlineUsername.trim().length < 2}
              className="w-full"
            >
              Add Offline Account
            </Button>
            <Button 
              onClick={() => setShowOffline(false)}
              variant="ghost"
              className="w-full"
            >
              ← Back
            </Button>
          </div>
        ) : authStatus === 'idle' || authStatus === 'error' ? (
          <div className="w-full space-y-3">
            {loginError && (
              <p className="text-red-400 text-xs bg-red-400/10 rounded-xl p-3">{loginError}</p>
            )}
            <Button 
              onClick={handleLogin}
              variant="outline"
              className="w-full bg-white text-black hover:bg-gray-100 border-0"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21" fill="currentColor">
                <path d="M0 0h10v10H0zM11 0h10v10H11zM0 11h10v10H0zM11 11h10v10H11z"/>
              </svg>
              Sign in with Microsoft
            </Button>
            <Button 
              onClick={() => setShowOffline(true)}
              variant="outline"
              className="w-full"
            >
              Add offline account
            </Button>
          </div>
        ) : authStatus === 'authenticating' ? (
          <div className="text-center py-8 space-y-4">
            <div className="flex justify-center">
              <Loader size={48} color="orange" />
            </div>
            <p className="text-text-s text-sm">Signing in with Microsoft...</p>
            <p className="text-text-d text-xs">Complete the sign-in in the popup window.</p>
            <button onClick={handleCancel} className="text-text-s text-xs hover:text-text-p transition-colors">
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
