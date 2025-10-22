import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CheckCircleIcon, XCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      await resetPassword(email);
      setSuccess(true);
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else {
        setError('Failed to send password reset email. Please try again.');
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
              <h1 className="text-xl sm:text-2xl font-semibold">Reset your password</h1>
              <p className="text-xs sm:text-sm text-white/70">
                Enter the email linked to your Choice account and we’ll send you a secure reset link.
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
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

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2 flex items-start gap-2">
                <XCircleIcon className="h-4 w-4 text-red-200 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-100">{error}</p>
              </div>
            )}

            {success && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/40 px-3 py-2 flex items-start gap-2">
                <CheckCircleIcon className="h-4 w-4 text-emerald-200 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-100">
                  Reset email sent! Check your inbox (and spam) for instructions to choose a new password.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || success}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white text-gray-900 font-semibold text-sm shadow-md hover:bg-white/95 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900" />
                  Sending...
                </>
              ) : (
                'Send reset link'
              )}
            </button>

            <div className="text-center text-[11px] text-white/70">
              <p className="mb-2">Remember your password?</p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 font-semibold text-white hover:text-white/85"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
 