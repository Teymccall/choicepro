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
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Reset your password</h1>
              <p className="text-sm text-gray-500">
                Enter the email linked to your Choice account and we’ll send you a secure reset link.
              </p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
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

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3 flex items-start gap-2">
                <XCircleIcon className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 flex items-start gap-2">
                <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-sm text-emerald-700">
                  Reset email sent! Check your inbox (and spam) for instructions to choose a new password.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || success}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-md"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Sending...</span>
                </div>
              ) : (
                'Send reset link'
              )}
            </button>

            <div className="text-center text-sm text-gray-500 pt-5 mt-2 border-t border-gray-100 flex flex-col items-center">
              <p className="mb-2">Remember your password?</p>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-700 transition-colors"
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
 