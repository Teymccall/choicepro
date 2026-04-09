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
    <div className="min-h-screen bg-white sm:bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col justify-center overflow-y-auto">
      <div className="w-full max-w-md mx-auto px-5 py-8 sm:p-8 sm:bg-white sm:border sm:border-gray-100 sm:rounded-3xl sm:shadow-sm my-auto">
        <div className="space-y-6 sm:space-y-7 w-full shrink-0">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center shadow-inner ring-1 ring-black/5">
              <img
                src="/choice_app_logo.png"
                alt="Choice"
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain drop-shadow-sm"
              />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Welcome back</h1>
              <p className="text-sm text-gray-500">
                Connect with your partner and keep the conversation going.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl font-medium text-sm shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="h-5 w-5"
              />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              <span className="h-px flex-1 bg-gray-200"></span>
              <span>Or email</span>
              <span className="h-px flex-1 bg-gray-200"></span>
            </div>

            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label htmlFor="email" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all shadow-sm"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-10 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={handleRememberMeChange}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-xs sm:text-sm text-gray-500">
                    Remember me
                  </label>
                </div>

                <Link
                  to="/forgot-password"
                  className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-3 flex items-start gap-2">
                  <XCircleIcon className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-md"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Continue'
                )}
              </button>
            </form>

            <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500 pt-2 border-t border-gray-100">
              <span>Don't have an account?</span>
              <Link
                to="/signup"
                className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Create one now
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center flex flex-col items-center gap-2">
          <div className="flex items-center gap-4 text-[11px] font-medium text-gray-400">
            <Link to="/terms" className="hover:text-gray-600 transition-colors">
              Terms of Use
            </Link>
            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
            <Link to="/privacy" className="hover:text-gray-600 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
 