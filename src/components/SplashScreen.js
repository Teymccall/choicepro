import React, { useEffect, useState } from 'react';

const SplashScreen = ({ onComplete }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Show splash for 2 seconds
    const timer = setTimeout(() => {
      setFadeOut(true);
      // Wait for fade animation before calling onComplete
      setTimeout(() => {
        onComplete();
      }, 500);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        paddingTop: 'var(--safe-area-inset-top)',
        paddingBottom: 'var(--safe-area-inset-bottom)',
        paddingLeft: 'var(--safe-area-inset-left)',
        paddingRight: 'var(--safe-area-inset-right)',
      }}
    >
      <div className="flex flex-col items-center justify-center space-y-6 animate-fade-in">
        {/* Logo with glow effect */}
        <div className="relative">
          <div className="absolute inset-0 bg-white/30 rounded-full blur-3xl animate-pulse"></div>
          <img 
            src="/choice_app_logo.png" 
            alt="Choice App Logo" 
            className="relative h-32 w-32 sm:h-40 sm:w-40 object-contain drop-shadow-2xl animate-bounce-slow"
          />
        </div>
        
        {/* App Name */}
        <div className="text-center space-y-2">
          <h1 className="text-5xl sm:text-6xl font-bold text-white tracking-tight drop-shadow-lg animate-slide-up">
            choice
          </h1>
          <p className="text-white/90 text-lg sm:text-xl font-medium animate-slide-up-delay">
            Make decisions together
          </p>
        </div>

        {/* Loading indicator */}
        <div className="flex space-x-2 animate-slide-up-delay-2">
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
