import React, { useEffect, useMemo, useState } from 'react';

const DISPLAY_DURATION_MS = 2400;
const FADE_DURATION_MS = 500;

const SplashScreen = ({ onComplete }) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setReduceMotion(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const visibleDuration = reduceMotion ? 1200 : DISPLAY_DURATION_MS;
    const fadeDelay = reduceMotion ? 0 : FADE_DURATION_MS;

    let completionTimer;
    const fadeTimer = setTimeout(() => {
      if (!reduceMotion) {
        setFadeOut(true);
      }

      completionTimer = setTimeout(() => {
        onComplete?.();
      }, fadeDelay);
    }, visibleDuration);

    return () => {
      clearTimeout(fadeTimer);
      if (completionTimer) clearTimeout(completionTimer);
    };
  }, [onComplete, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) {
      setProgress(100);
      return undefined;
    }

    const totalSteps = Math.ceil(DISPLAY_DURATION_MS / 80);
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep += 1;
      const percentage = Math.min(100, Math.round((currentStep / totalSteps) * 100));
      setProgress(percentage);

      if (percentage >= 100) {
        clearInterval(interval);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [reduceMotion]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#0b0c1a] transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        paddingTop: 'var(--safe-area-inset-top)',
        paddingBottom: 'var(--safe-area-inset-bottom)',
        paddingLeft: 'var(--safe-area-inset-left)',
        paddingRight: 'var(--safe-area-inset-right)',
      }}
      role="presentation"
      aria-hidden={!fadeOut}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-rose-500 opacity-80" />
      <div
        className={
          "absolute inset-0 bg-[url(\"data:image/svg+xml,%3Csvg width='160' height='160' viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-opacity='0.08' stroke='%23ffffff' stroke-width='0.5'%3E%3Cpath d='M0 0h160v160H0z'/%3E%3Ccircle cx='80' cy='80' r='48'/%3E%3Ccircle cx='80' cy='80' r='80'/%3E%3C/g%3E%3C/svg%3E\")]"
        }
      />

      <div className={`relative z-10 w-full max-w-sm sm:max-w-md mx-auto px-6 ${reduceMotion ? '' : 'animate-fade-in'}`}>
        <div className="flex flex-col items-center text-center space-y-8">
          <div className="relative">
            <div className={`absolute inset-0 rounded-full blur-3xl bg-white/30 ${reduceMotion ? '' : 'animate-pulse-slow'}`} />
            <img
              src="/choice_app_logo.png"
              alt="Choice App Logo"
              className={`relative h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-2xl ${reduceMotion ? '' : 'animate-bounce-slow'}`}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs sm:text-sm uppercase tracking-[0.35em] text-white/70">
              Welcome to Choice
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold text-white">
              Connect with your partner
            </h1>
            <p className="text-sm sm:text-base text-white/75">
              Getting everything ready so you can jump back into the conversation.
            </p>
          </div>

          <div className="w-full bg-white/10 border border-white/10 rounded-3xl p-6 backdrop-blur-lg shadow-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-4">
              Loading workspace
            </p>
            <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-white transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
                aria-hidden="true"
              />
            </div>
            <p className="mt-4 text-xs text-white/60">
              Preparing secure chat environment…
            </p>
          </div>

          <p className="text-[11px] text-white/50">
            Tip: Add Choice to your home screen for faster PWA access.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
