'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone mode (PWA installed) or native Capacitor
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    if (checkStandalone()) {
      return;
    }

    // 2. Register Service Worker for PWA compliance
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('PWA Service Worker registered:', reg.scope))
        .catch((err) => console.warn('PWA Service Worker registration error:', err));
    } else if ('serviceWorker' in navigator) {
      // In development, also register to allow beforeinstallprompt testing
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    const isDismissed = sessionStorage.getItem('pwa_prompt_dismissed') === 'true';

    // 4. Handle Chromium / Android / Desktop beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      if (!isDismissed) {
        // Slight delay for smooth entrance after page load
        setTimeout(() => {
          setIsOpen(true);
        }, 1500);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If on iOS and not dismissed and not standalone, show prompt after delay
    if (isIOSDevice && !isDismissed) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
        setIsOpen(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Fallback: If prompt is not available, inform user
      alert('Untuk menginstal aplikasi, buka menu browser Anda lalu pilih "Instal Aplikasi" atau "Tambahkan ke Layar Utama".');
      setIsOpen(false);
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    setShowIOSGuide(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (isStandalone || !isOpen) {
    return null;
  }

  return (
    <aside aria-label="Instalasi Aplikasi" className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 z-[9999] max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border border-emerald-500/25 ring-1 ring-black/5 dark:ring-white/10">
        <div className="flex items-start gap-4">
          {/* App Logo */}
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-md border border-emerald-100 flex-shrink-0 bg-white p-1">
            <Image
              src="/logo.jpg"
              alt="Logo WarungSirkular"
              width={56}
              height={56}
              className="object-contain w-full h-full"
              priority
            />
          </div>

          {/* App Information */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
                Pasang WarungSirkular
              </h3>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 -mr-1 rounded-lg transition-colors"
                aria-label="Tutup"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              Pasang di layar utama ponsel atau komputer untuk akses cepat, hemat kuota, dan pengalaman aplikasi native.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50">
                ⚡ Akses Instan
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/50">
                📦 Hemat Kuota
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50">
                📱 Fullscreen
              </span>
            </div>
          </div>
        </div>

        {/* iOS Step Guide if requested */}
        {showIOSGuide && (
          <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 space-y-2">
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
              Cara Pasang di iPhone/iPad (Safari):
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1 text-[11px]">
              <li>
                Ketuk tombol <strong className="inline-flex items-center px-1 bg-white dark:bg-slate-700 rounded border">Bagikan (Share) ⎋</strong> di bilah bawah browser.
              </li>
              <li>
                Gulir ke bawah dan ketuk <strong className="font-medium text-slate-900 dark:text-white">&ldquo;Tambahkan ke Layar Utama&rdquo;</strong> (Add to Home Screen).
              </li>
              <li>
                Ketuk <strong className="text-emerald-600 font-semibold">&ldquo;Tambah&rdquo;</strong> di sudut kanan atas.
              </li>
            </ol>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleDismiss}
            className="flex-1 py-2 px-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-center"
          >
            Nanti Saja
          </button>
          <button
            onClick={handleInstallClick}
            className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-md shadow-emerald-600/25 transition-all transform active:scale-95 flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {isIOS && !showIOSGuide ? 'Petunjuk Pasang' : 'Instal Sekarang'}
          </button>
        </div>
      </div>
    </aside>
  );
}
