import React from 'react';
import { Loader } from './Loader';

interface SplashScreenProps {
  status: string;
  updateVersion?: string | null;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ status, updateVersion }) => {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
      <div className="flex flex-col items-center gap-8">
        <img
          src="/Spring-orange.png"
          alt="Spring"
          className="w-32 h-32 object-contain"
        />
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">Spring</h1>
          <p className="text-lg text-white/60 mt-2">{status}</p>
          {updateVersion && (
            <p className="text-sm text-orange-500 mt-1">v{updateVersion} available</p>
          )}
        </div>
        <Loader size={150} color="orange" />
      </div>
    </div>
  );
};
