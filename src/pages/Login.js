import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cookieManager } from '../utils/cookieManager';
import { 
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { setPersistence, browserLocalPersistence, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { auth, rtdb } from '../firebase/config';

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [showCookieConsent, setShowCookieConsent] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const { login, signup, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  // Check for cookie consent and saved credentials on mount
  useEffect(() => {
    if (!cookieManager.hasConsent()) {
      setShowCookieConsent(true);
    } else {
      // Only load saved state if user has given consent
      const savedEmail = cookieManager.getSavedEmail();
      const wasRemembered = cookieManager.getRememberMe();
      
      if (savedEmail && wasRemembered) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }
  }, []);

  // Password requirements
  const requirements = [
    { text: 'At least 8 characters', met: password.length >= 8 },
    { text: 'At least one uppercase letter', met: /[A-Z]/.test(password) },
    { text: 'At least one number', met: /[0-9]/.test(password) },
    { text: 'At least one special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');
      setIsConnecting(true);

      // Use the context's login function
      await login(email.trim(), password);
      
      // Save credentials if remember me is checked
      if (rememberMe) {
        cookieManager.saveAuthState(email, true);
        cookieManager.recordLastLogin(email);
      } else {
        cookieManager.clearAuthState();
      }
      
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection and try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many login attempts. Please try again later.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email format.');
      } else {
        setError('Failed to log in. Please check your credentials and try again.');
      }
      cookieManager.clearAuthState();
    } finally {
      setIsLoading(false);
      setIsConnecting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');
      setIsConnecting(true);

      // Set persistence to LOCAL before signing in
      await setPersistence(auth, browserLocalPersistence);
      
      const user = await signInWithGoogle();
      
      if (user) {
        // Check database connection
        const connectedRef = ref(rtdb, '.info/connected');
        await new Promise((resolve, reject) => {
          let resolved = false;
          let unsubscribe = null;

          // Setup timeout
          const timeoutId = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              if (unsubscribe) unsubscribe();
              reject(new Error('Connection timeout'));
            }
          }, 10000);

          // Setup listener
          unsubscribe = onValue(connectedRef, 
            (snap) => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                if (unsubscribe) unsubscribe();
                if (snap.val() === true) {
                  resolve();
                } else {
                  reject(new Error('No connection to database'));
                }
              }
            },
            (error) => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                if (unsubscribe) unsubscribe();
                reject(error);
              }
            }
          );
        });

        cookieManager.saveAuthState(user.email, rememberMe);
        cookieManager.recordLastLogin(user.email);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Google Sign In error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.message.includes('user-cancelled')) {
        setError('Sign-in was cancelled. Please try again if you want to sign in with Google.');
      } else if (err.message.includes('IdP')) {
        setError('Google sign-in was declined. You can try again or use email to sign in.');
      } else if (err.message.includes('verify your email')) {
        setSuccess(err.message);
      } else if (err.message === 'Connection timeout') {
        setError('Connection timed out. Please check your internet and try again.');
      } else if (err.message === 'No connection to database') {
        setError('Unable to connect to the service. Please try again.');
      } else {
        setError('Unable to sign in with Google. Please try another sign-in method.');
      }
      cookieManager.clearAuthState();
    } finally {
      setIsLoading(false);
      setIsConnecting(false);
    }
  };

  const toggleMode = () => {
    setIsSignup(!isSignup);
    setError('');
    setSuccess('');
    setPassword('');
    
    // Clear email only if remember me is not checked
    if (!rememberMe) {
      setEmail('');
    }
    setDisplayName('');
  };

  const handleCookieConsent = (accepted) => {
    cookieManager.setConsent(accepted);
    setShowCookieConsent(false);
    
    if (!accepted) {
      // Clear all saved data if cookies are declined
      setRememberMe(false);
      setEmail('');
      cookieManager.clearAuthState();
    }
  };

  const handleRememberMeChange = (e) => {
    const newValue = e.target.checked;
    setRememberMe(newValue);
    
    // Clear saved state if remember me is unchecked
    if (!newValue) {
      cookieManager.clearAuthState();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0b0c1a] via-[#181b3a] to-[#3b2a6d] text-white">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:py-12">
        <div className="w-full max-w-sm sm:max-w-md bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl px-6 sm:px-8 py-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-2xl bg-white/18 flex items-center justify-center shadow-inner">
              <img
                src="/choice_app_logo.png"
                alt="Choice"
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
              />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-semibold">Welcome back</h1>
              <p className="text-xs sm:text-sm text-white/70">
                Connect with your partner and keep the conversation going.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white text-gray-900 rounded-full font-medium text-sm shadow-sm hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="h-4 w-4"
              />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/55">
              <span className="h-px flex-1 rounded-full bg-white/15"></span>
              <span className="px-4 py-1 rounded-full bg-white/12 backdrop-blur-sm text-white/75">
                Or Email
              </span>
              <span className="h-px flex-1 rounded-full bg-white/15"></span>
            </div>

            <form className="space-y-3" onSubmit={handleLogin}>
              <div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-full bg-white/90 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-white/80 focus:border-transparent transition-all"
                  placeholder="Email address"
                />
              </div>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 rounded-full bg-white/90 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-white/80 focus:border-transparent transition-all"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-medium text-white/75 hover:text-white"
                >
                  Forgot password?
                </Link>
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2">
                  <p className="text-xs text-red-100">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2.5 rounded-full bg-white text-gray-900 font-semibold text-sm shadow-md hover:bg-white/95 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900" />
                    <span>Signing in…</span>
                  </div>
                ) : (
                  'Continue'
                )}
              </button>
            </form>

            <div className="flex flex-col items-center gap-1 text-[11px] text-white/65">
              <span>Don't have an account?</span>
              <Link
                to="/signup"
                className="font-semibold text-white hover:text-white/85"
              >
                Create one now
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-[10px] text-white/50">
          <div className="flex items-center justify-center gap-3">
            <Link to="/terms" className="hover:text-white/80">
              Terms of Use
            </Link>
            <span className="text-white/40">•</span>
            <Link to="/privacy" className="hover:text-white/80">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
 