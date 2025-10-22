import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  UserGroupIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  WifiIcon,
  ClockIcon,
  PlusCircleIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'react-hot-toast';

const ConnectPartner = () => {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [sendingInviteTo, setSendingInviteTo] = useState(null);
  const { 
    user, 
    partner, 
    connectPartner, 
    activeInviteCode, 
    generateInviteCode, 
    isOnline,
    setActiveInviteCode,
    disconnectPartner,
    disconnectMessage,
    clearDisconnectMessage,
    searchUsers,
    sendPartnerRequest,
    pendingRequests,
    acceptPartnerRequest,
    declinePartnerRequest,
    setPendingRequests,
  } = useAuth();

  const inputRef = useRef(null);
  const searchTimeout = useRef(null);

  // Calculate time left for active invite code
  useEffect(() => {
    if (!activeInviteCode) {
      setTimeLeft(null);
      return;
    }

    const updateTimeLeft = () => {
      const now = Date.now();
      const expiresAt = activeInviteCode.expiresAt instanceof Date 
        ? activeInviteCode.expiresAt.getTime()
        : activeInviteCode.expiresAt.toMillis();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        setTimeLeft(null);
        setActiveInviteCode(null); // Clear the active invite code when it expires
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [activeInviteCode, setActiveInviteCode]);

  // Focus input when modal opens
  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, [isSearchOpen]);

  // Debounced search effect
  useEffect(() => {
    const performSearch = async () => {
      if (searchTerm.length >= 2) {
        setIsSearching(true);
        try {
          const results = await searchUsers(searchTerm);
          setSearchResults(results);
          setSearchError(results.length === 0 ? 'No users found' : '');
        } catch (error) {
          setSearchError(error.message);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setSearchError(searchTerm.length > 0 ? 'Please enter at least 2 characters' : '');
      }
    };

    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchUsers]);

  // Clear search state when modal closes
  useEffect(() => {
    if (!isSearchOpen) {
      setSearchTerm('');
      setSearchResults([]);
      setSearchError('');
      setIsSearching(false);
    }
  }, [isSearchOpen]);

  const handleGenerateCode = async () => {
    setError('');
    setIsLoading(true);
    try {
      await generateInviteCode();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setSuccess(false);

    try {
      await connectPartner(inviteCode);
      setSuccess(true);
      setInviteCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeInviteCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleDisconnect = async () => {
    setError('');
    setIsLoading(true);
    try {
      await disconnectPartner();
    } catch (err) {
      setError(err.message);
      console.error('Disconnect error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchError('Please enter at least 2 characters');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    try {
      const results = await searchUsers(searchTerm);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No users found');
      }
    } catch (error) {
      setSearchError(error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (userId, userName) => {
    setSendingInviteTo(userId);
    setError('');
    try {
      await sendPartnerRequest(userId);
      toast.success(
        <div className="flex flex-col">
          <span className="font-bold">Invite sent successfully! 🎉</span>
          <span className="text-sm">{userName} will see it in their notifications</span>
        </div>,
        {
          duration: 5000,
          position: 'top-center',
        }
      );
      setSuccess(true);
      setIsSearchOpen(false);
      setSearchTerm('');
      setSearchResults([]);
      setSearchError('');
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Failed to send invite', {
        duration: 3000,
        position: 'top-center',
      });
    } finally {
      setSendingInviteTo(null);
    }
  };

  const handleDeclineRequest = async (requestId) => {
    if (!requestId) return;
    
    setIsLoading(true);
    try {
      await declinePartnerRequest(requestId);
      
      // Show success notification
      toast.success('Request declined successfully', {
        duration: 3000,
        position: 'top-center',
      });
    } catch (error) {
      // Show error notification
      toast.error(error.message || 'Failed to decline request', {
        duration: 4000,
        position: 'top-center',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOnline) {
    return (
      <div className="relative overflow-hidden bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-8 rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/50">
        <div className="absolute top-0 right-0 w-40 h-40 bg-red-400 opacity-10 rounded-full blur-3xl" />
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white dark:bg-gray-900 rounded-2xl shadow-lg mb-4">
            <img 
              src="/choice_app_logo.png" 
              alt="Choice App" 
              className="w-16 h-16 object-contain"
            />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">You're Offline</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Please check your internet connection to connect with your partner
          </p>
        </div>
      </div>
    );
  }

  if (disconnectMessage) {
    return (
      <div className="relative overflow-hidden bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-8 rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/50 animate-fade-in">
        <div className="absolute top-0 right-0 w-40 h-40 bg-red-400 opacity-10 rounded-full blur-3xl" />
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white dark:bg-gray-900 rounded-2xl shadow-lg mb-4">
            <img 
              src="/choice_app_logo.png" 
              alt="Choice App" 
              className="w-16 h-16 object-contain"
            />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Partnership Ended</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{disconnectMessage}</p>
          <button
            onClick={clearDisconnectMessage}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-600 bg-primary-50 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-1.5" />
            Return to Connection
          </button>
        </div>
      </div>
    );
  }

  if (partner) {
    return (
      <div className="relative overflow-hidden bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/50 animate-fade-in">
        <div className="absolute top-0 right-0 w-40 h-40 bg-green-400 opacity-10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-400 opacity-10 rounded-full blur-3xl" />
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center w-full max-w-[300px] space-x-3">
            <div className="text-center flex-1 min-w-0">
              <UserGroupIcon className="h-7 w-7 text-black dark:text-white mx-auto" />
              <p className="mt-1.5 font-medium text-gray-900 dark:text-white text-sm truncate px-1">
                {user.displayName}
              </p>
            </div>
            <div className="flex items-center flex-shrink-0 px-2">
              <div className="h-0.5 w-8 bg-black dark:bg-white"></div>
              <CheckCircleIcon className="h-6 w-6 text-green-500 mx-1.5 animate-bounce" />
              <div className="h-0.5 w-8 bg-black dark:bg-white"></div>
            </div>
            <div className="text-center flex-1 min-w-0">
              <UserGroupIcon className="h-7 w-7 text-black dark:text-white mx-auto" />
              <p className="mt-1.5 font-medium text-gray-900 dark:text-white text-sm truncate px-1">
                {partner.displayName}
              </p>
            </div>
          </div>
          <p className="mt-3 text-center text-sm text-gray-600 dark:text-gray-400">
            You are connected with your partner!
          </p>
          {error && (
            <div className="mt-3 flex items-center justify-center text-red-500 text-sm animate-shake">
              <XCircleIcon className="h-5 w-5 mr-1.5" />
              {error}
            </div>
          )}
          <button
            onClick={handleDisconnect}
            disabled={isLoading}
            className="mt-3 w-full max-w-[300px] flex items-center justify-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-900 dark:text-red-200 dark:border-red-800 dark:hover:bg-red-800"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-700 dark:border-red-200"></div>
                <span className="ml-2">Disconnecting...</span>
              </div>
            ) : (
              <>
                <XCircleIcon className="h-5 w-5 mr-1.5" />
                Disconnect Partnership
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl p-5 sm:p-6 rounded-2xl shadow-xl border border-white/20 dark:border-gray-700/50">
      {/* Decorative gradient blurs */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-400 to-purple-400 opacity-10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-purple-400 to-pink-400 opacity-10 rounded-full blur-3xl" />
      
      <div className="relative text-center mb-4">
        {/* Logo with gradient background */}
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white dark:bg-gray-900 rounded-2xl shadow-lg mb-3 transform hover:scale-105 transition-transform duration-300">
          <img 
            src="/choice_app_logo.png" 
            alt="Choice App" 
            className="w-12 h-12 object-contain"
          />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Connect with Partner</h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          Search for a partner or enter their invite code to connect
        </p>
      </div>

      <div className="space-y-5">
        {/* Invite Code Section */}
        <div className="relative space-y-4">
          <div className="flex-1">
            <label htmlFor="inviteCode" className="sr-only">
              Partner's Invite Code
            </label>
            <input
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="ENTER PARTNER'S INVITE CODE"
              className="block w-full px-4 py-3 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-2 border-gray-200 dark:border-gray-700 rounded-xl shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-purple-500 dark:focus:border-purple-500 text-center uppercase tracking-[0.2em] font-bold text-gray-900 dark:text-white transition-all duration-300 hover:border-blue-300 dark:hover:border-purple-600"
              maxLength={6}
            />
          </div>

          {error && (
            <div className="flex items-center justify-center text-red-500 text-sm animate-shake">
              <XCircleIcon className="h-5 w-5 mr-1.5" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center justify-center text-green-500 text-sm animate-bounce">
              <CheckCircleIcon className="h-5 w-5 mr-1.5" />
              Successfully connected!
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading || inviteCode.length !== 6}
            className={`w-full flex items-center justify-center px-6 py-3 border-none text-base font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 dark:focus:ring-purple-500/50 shadow-lg hover:shadow-xl transition-all duration-300 ${
              isLoading || inviteCode.length !== 6
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:scale-[1.02] active:scale-95'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                <span className="ml-2">Connecting...</span>
              </div>
            ) : (
              <>
                <ArrowRightIcon className="h-5 w-5 mr-2" strokeWidth={2.5} />
                Connect
              </>
            )}
          </button>
        </div>

        {/* Active Invite Code Section - Compact */}
        {activeInviteCode && (
          <div className="mt-3 p-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Your Invite Code</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-mono font-bold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                    {activeInviteCode.code}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Copy code"
                  >
                    {copied ? (
                      <ClipboardDocumentCheckIcon className="h-4 w-4 text-green-500" />
                    ) : (
                      <ClipboardDocumentIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    )}
                  </button>
                </div>
                {timeLeft !== null && (
                  <div className="flex items-center gap-1 mt-1">
                    <ClockIcon className="h-3 w-3 text-orange-500" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg transition-all shadow-sm hover:shadow-md"
                title="Search for partners"
              >
                <MagnifyingGlassIcon className="h-5 w-5 text-white" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}

        {!activeInviteCode && (
          <button
            onClick={handleGenerateCode}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center px-6 py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 text-base font-semibold rounded-xl text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400 dark:hover:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/30 transition-all duration-300 hover:scale-[1.02]"
          >
            <PlusCircleIcon className="h-6 w-6 mr-2" strokeWidth={2} />
            Generate New Code
          </button>
        )}

        {/* Search Modal - Glassmorphism */}
        <Dialog 
          open={isSearchOpen} 
          onClose={() => setIsSearchOpen(false)}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-md" aria-hidden="true" />

          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Dialog.Panel className="relative w-full max-w-lg transform overflow-hidden rounded-3xl bg-white/90 backdrop-blur-2xl shadow-2xl transition-all border border-white/20">
                {/* Gradient glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-2xl -z-10" />
                
                {/* Header with glassmorphism */}
                <div className="relative bg-gradient-to-r from-blue-600/90 to-purple-600/90 backdrop-blur-xl px-6 py-5 border-b border-white/20">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-2xl font-bold text-white flex items-center gap-2">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Search for a Partner
                    </Dialog.Title>
                    <button
                      onClick={() => setIsSearchOpen(false)}
                      className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-2 transition-all duration-200"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Content with glassmorphism */}
                <div className="p-6 bg-white/50 backdrop-blur-xl">
                  {/* Search Input with glassmorphism */}
                  <div className="relative">
                    <input
                      ref={inputRef}
                      id="partnerSearchInput"
                      name="partnerSearch"
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full px-4 py-4 pl-12 bg-white/80 backdrop-blur-sm border-2 border-white/40 rounded-2xl shadow-lg placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-blue-400 transition-all duration-200 text-gray-900 font-medium"
                      placeholder="Search by name or email..."
                      autoComplete="off"
                      spellCheck="false"
                    />
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {isSearching && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                      </div>
                    )}
                  </div>

                  {searchError && (
                    <div className="mt-3 p-3 bg-red-50/80 backdrop-blur-sm border border-red-200 rounded-xl">
                      <p className="text-sm font-medium text-red-800">{searchError}</p>
                    </div>
                  )}

                  {/* Search Results with glassmorphism */}
                  <div className="mt-5 space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {searchResults.length === 0 && searchTerm.length >= 2 && !isSearching && (
                      <div className="text-center py-8">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="mt-2 text-sm text-gray-500">No users found</p>
                      </div>
                    )}
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-center gap-3 p-4 bg-white/80 backdrop-blur-sm border-2 border-white/60 rounded-2xl hover:border-blue-400 hover:shadow-xl hover:bg-white/90 transition-all duration-200 group"
                      >
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          {result.photoURL ? (
                            <img
                              src={result.photoURL}
                              alt={result.displayName}
                              className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-200"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                              <span className="text-white text-lg font-bold">
                                {(result.displayName || result.email || 'U').charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{result.displayName}</p>
                          <p className="text-sm text-gray-500 truncate">{result.email}</p>
                        </div>
                        
                        {/* Invite Button */}
                        <button
                          onClick={() => handleSendRequest(result.id, result.displayName)}
                          disabled={sendingInviteTo === result.id}
                          className="flex-shrink-0 px-4 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[90px]"
                        >
                          {sendingInviteTo === result.id ? (
                            <span className="flex items-center gap-2 justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                              <span className="hidden sm:inline">Sending...</span>
                            </span>
                          ) : (
                            'Invite'
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      </div>
    </div>
  );
};

export default ConnectPartner; 