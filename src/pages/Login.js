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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-white p-4 rounded-3xl shadow-2xl">
                <img 
                  src="/choice_app_logo.png" 
                  alt="Choice App" 
                  className="h-24 w-24"
                />
              </div>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome Back
          </h2>
          <p className="text-gray-600">
            Sign in to continue to Choice
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                Sign up
              </Link>
            </p>
          </div>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              className="h-5 w-5"
            />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form className="space-y-5" onSubmit={handleLogin}>
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                placeholder="Enter your email"
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => {
                    setRememberMe(e.target.checked);
                    if (!e.target.checked) {
                      cookieManager.clearAuthState();
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>

              <Link 
                to="/forgot-password" 
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl bg-red-50 border-2 border-red-200 p-4">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRightIcon className="h-5 w-5" strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 