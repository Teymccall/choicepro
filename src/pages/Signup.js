import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  
  const { signup, user } = useAuth();
  const navigate = useNavigate();



  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSignup = async (e) => {
    e.preventDefault();
    
    // Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      await signup(email, password, displayName);
      navigate('/dashboard');
    } catch (err) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak.');
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white sm:bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col justify-start sm:justify-center overflow-x-hidden">
      <div className="w-full max-w-md mx-auto px-5 pt-10 pb-24 sm:p-8 sm:bg-white sm:border sm:border-gray-100 sm:rounded-3xl sm:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
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
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Create your account</h1>
              <p className="text-sm text-gray-500">
                Secure your space on Choice and start building together with your partner.
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSignup}>
            <div>
              <label htmlFor="displayName" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                Display name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all shadow-sm"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
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
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all shadow-sm"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocus(true)}
                  onBlur={() => setPasswordFocus(false)}
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



            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3 flex items-start gap-2 text-left">
                <span className="text-red-500 mt-0.5 shrink-0">
                  <XMarkIcon className="h-4 w-4" />
                </span>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || password.length === 0}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-md mt-2"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Creating account...</span>
                </div>
              ) : (
                'Sign up'
              )}
            </button>

            <div className="text-center text-sm text-gray-500 pt-5 mt-2 border-t border-gray-100 flex flex-col items-center">
              <span>Already have an account?</span>
              <Link
                to="/login"
                className="font-semibold text-blue-600 hover:text-blue-700 transition-colors mt-1"
              >
                Log in instead
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-8 text-center flex flex-col items-center gap-2 pb-4">
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
 