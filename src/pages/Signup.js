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

  const handleSignup = async (e) => {
    e.preventDefault();
    
    // Validate password requirements
    if (!requirements.every(req => req.met)) {
      setError('Please meet all password requirements');
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
              <h1 className="text-xl sm:text-2xl font-semibold">Create your account</h1>
              <p className="text-xs sm:text-sm text-white/70">
                Secure your space on Choice and start building together with your partner or team.
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSignup}>
            <div className="space-y-2">
              <label htmlFor="displayName" className="block text-xs font-semibold uppercase tracking-[0.25em] text-white/55">
                Display name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-full bg-white/92 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-white/80 focus:border-transparent transition-all"
                placeholder="How should we address you?"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-[0.25em] text-white/55">
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
                className="w-full px-4 py-2.5 rounded-full bg-white/92 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-white/80 focus:border-transparent transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-[0.25em] text-white/55">
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
                  className="w-full px-4 py-2.5 pr-10 rounded-full bg-white/92 text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-white/80 focus:border-transparent transition-all"
                  placeholder="Create a strong password"
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
            </div>

            {passwordFocus && password && (
              <div className="rounded-xl bg-white/8 border border-white/10 px-4 py-3 space-y-1">
                <p className="text-[11px] font-semibold text-white/75">Password must include</p>
                <ul className="space-y-1">
                  {requirements.map((req, index) => (
                    <li key={index} className="flex items-center text-[11px] text-white/70">
                      {req.met ? (
                        <CheckIcon className="h-3.5 w-3.5 text-emerald-300 mr-2" />
                      ) : (
                        <XMarkIcon className="h-3.5 w-3.5 text-white/30 mr-2" />
                      )}
                      <span className={req.met ? 'text-emerald-200' : 'text-white/65'}>
                        {req.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2">
                <p className="text-xs text-red-100">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !requirements.every(req => req.met)}
              className="w-full px-4 py-2.5 rounded-full bg-white text-gray-900 font-semibold text-sm shadow-md hover:bg-white/95 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900" />
                  <span>Creating account…</span>
                </div>
              ) : (
                'Sign up'
              )}
            </button>
          </form>

          <div className="flex flex-col items-center gap-1 text-[11px] text-white/65">
            <span>Already have an account?</span>
            <Link
              to="/login"
              className="font-semibold text-white hover:text-white/85"
            >
              Log in instead
            </Link>
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
 