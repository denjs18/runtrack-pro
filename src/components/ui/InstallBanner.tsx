'use client';

import { useState, useEffect } from 'react';
import { X, Share, Plus } from 'lucide-react';

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);
}

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void } | null>(null);

  useEffect(() => {
    if (isStandalone()) return; // already installed
    if (sessionStorage.getItem('install-dismissed')) return;

    if (isIOS()) {
      setPlatform('ios');
      setShow(true);
    } else if (isAndroid()) {
      setPlatform('android');
      // show immediately, Android prompt comes via event
      setShow(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt: () => void });
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem('install-dismissed', '1');
    setShow(false);
  };

  const handleAndroidInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      setShow(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] px-3 pb-3 pointer-events-none">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden pointer-events-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-xl flex-none">
            🏃
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Installer RunTrack Pro</p>
            <p className="text-xs text-gray-500">Plein écran · Hors ligne · Accès rapide</p>
          </div>
          <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions */}
        <div className="px-4 py-3">
          {platform === 'ios' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 dark:text-gray-300 font-medium mb-2">
                Pour passer en plein écran sur iPhone :
              </p>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold flex-none">1</div>
                <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                  Appuyez sur
                  <span className="inline-flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 text-xs font-medium">
                    <Share className="w-3 h-3" /> Partager
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold flex-none">2</div>
                <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                  Puis
                  <span className="inline-flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 text-xs font-medium">
                    <Plus className="w-3 h-3" /> Sur l&apos;écran d&apos;accueil
                  </span>
                </div>
              </div>
            </div>
          )}

          {platform === 'android' && (
            <div className="space-y-2">
              {deferredPrompt ? (
                <button
                  onClick={handleAndroidInstall}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Installer l&apos;application
                </button>
              ) : (
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Menu ⋮ → <strong>Ajouter à l&apos;écran d&apos;accueil</strong>
                </p>
              )}
            </div>
          )}

          <button
            onClick={dismiss}
            className="mt-3 w-full text-xs text-gray-400 text-center py-1"
          >
            Continuer dans le navigateur
          </button>
        </div>
      </div>
    </div>
  );
}
