import React from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Play } from 'lucide-react';
import { Button } from '../components/Button';

const formatLastPlayed = (timestamp?: number) => {
  if (!timestamp) return 'Never played';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

const InstanceIcon: React.FC<{ icon?: string; name: string; size?: 'sm' | 'md' }> = ({
  icon,
  name,
  size = 'md',
}) => {
  const dim = size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';
  const text = size === 'sm' ? 'text-sm' : 'text-base';
  return (
    <div
      className={`${dim} rounded-lg overflow-hidden flex-shrink-0 bg-inner3 border border-border flex items-center justify-center ${text} font-medium text-text-s`}
    >
      {icon && icon.startsWith('/') ? (
        <img
          src={convertFileSrc(icon)}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
};

export const HomePanel: React.FC = () => {
  const { auth, instances, pushPanel } = useLauncherStore();

  const sorted = [...instances].sort((a, b) => {
    if (a.lastPlayed && b.lastPlayed) return b.lastPlayed - a.lastPlayed;
    if (a.lastPlayed) return -1;
    if (b.lastPlayed) return 1;
    return 0;
  });

  const recent = sorted.slice(0, 4);
  const more = sorted.slice(4, 8);

  const quickLinks = [
    { label: 'Discover', sub: 'Find new modpacks', panel: 'discover' },
    { label: 'Library', sub: 'All instances', panel: 'library' },
    { label: 'Skins', sub: 'Customize your look', panel: 'skins' },
    { label: 'Settings', sub: 'Configure launcher', panel: 'settings' },
  ] as const;

  return (
    <div className="h-full overflow-y-auto p-8 scroll-hide">
      {/* Greeting */}
      <h1 className="text-2xl font-semibold text-text-p mb-8">
        Welcome back{auth ? `, ${auth.username}` : ''}
      </h1>

      {/* Quick links */}
      <section className="mb-8">
        <p className="text-[11px] font-medium text-text-s uppercase tracking-widest mb-3">
          Quick access
        </p>
        <div className="grid grid-cols-4 gap-2">
          {quickLinks.map(({ label, sub, panel }) => (
            <button
              key={label}
              className="text-left p-3 bg-inner2 border border-border rounded-xl hover:border-text-p/20 hover:bg-inner3 transition-colors"
              onClick={() => pushPanel(panel)}
            >
              <p className="text-sm font-medium text-text-p">{label}</p>
              <p className="text-[11px] text-text-s mt-0.5">{sub}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Continue playing */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-medium text-text-s uppercase tracking-widest">
            Continue playing
          </p>
          <button
            className="text-[11px] text-text-s hover:text-text-p transition-colors"
            onClick={() => pushPanel('library')}
          >
            See all →
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {recent.length > 0 ? (
            recent.map((instance) => (
              <div
                key={instance.id}
                className="group flex items-center gap-3 p-3 bg-inner2 border border-border rounded-xl cursor-pointer hover:border-text-p/20 transition-colors"
                onClick={() => pushPanel('instanceDetail', { id: instance.id })}
              >
                <InstanceIcon icon={instance.icon} name={instance.name} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-p truncate">{instance.name}</p>
                  <p className="text-[11px] text-text-s mt-0.5">
                    {instance.loader} · {instance.version} · {formatLastPlayed(instance.lastPlayed)}
                  </p>
                </div>

                <Button
                  className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    // launch instance
                  }}
                >
                  <Play size={12} className="mr-1" fill="currentColor" />
                  Play
                </Button>
              </div>
            ))
          ) : (
            <div className="col-span-2 p-8 border border-dashed border-border rounded-xl text-center text-text-s text-sm">
              No instances yet — click the + button in the sidebar to create one.
            </div>
          )}
        </div>
      </section>

      {/* More worlds */}
      {more.length > 0 && (
        <section>
          <p className="text-[11px] font-medium text-text-s uppercase tracking-widest mb-3">
            More worlds
          </p>
          <div className="grid grid-cols-4 gap-2">
            {more.map((instance) => (
              <div
                key={instance.id}
                className="p-3 bg-inner2 border border-border rounded-xl cursor-pointer hover:border-text-p/20 transition-colors"
                onClick={() => pushPanel('instanceDetail', { id: instance.id })}
              >
                <InstanceIcon icon={instance.icon} name={instance.name} size="sm" />
                <p className="text-sm font-medium text-text-p truncate mt-2">{instance.name}</p>
                <p className="text-[11px] text-text-s mt-0.5">{instance.version}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};