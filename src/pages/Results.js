import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircleIcon,
  XCircleIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  UserIcon,
  UserGroupIcon,
  LightBulbIcon,
  TagIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { ref, onValue, update, serverTimestamp } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { Link } from 'react-router-dom';
import { PlusCircleIcon } from '@heroicons/react/24/outline';

const SUGGESTIONS = {
  matched: {
    agree: [
      "Keep up the great communication!",
      "Consider setting regular check-ins to maintain this alignment",
      "Share what's working well with each other",
    ],
    disagree: [
      "You both see room for improvement - that's a great starting point",
      "Consider discussing specific changes you'd both like to see",
      "Set small, achievable goals together",
    ],
  },
  mismatched: [
    "Take time to understand each other's perspective",
    "Consider scheduling a dedicated discussion about this topic",
    "Remember that disagreement is normal and can lead to growth",
    "Try using 'I feel' statements when discussing this topic",
  ],
};

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  // Handle both Realtime DB timestamps (numbers) and Firestore timestamps (objects)
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp.toDate?.() || new Date(timestamp);
  return date.toLocaleDateString();
};

const Results = () => {
  const { user, partner, isOnline } = useAuth();
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalTopics: 0,
    completedTopics: 0,
    pendingTopics: 0,
    matchedTopics: 0,
    agreementRate: 0,
  });

  // Fetch completed topics
  useEffect(() => {
    if (!user?.uid || !partner?.uid || !isOnline) {
      setResults([]);
      setLoading(false);
      return;
    }

    const topicsRef = ref(rtdb, 'topics');
    
    const unsubscribe = onValue(topicsRef, (snapshot) => {
      try {
        if (!isOnline) {
          setResults([]);
          setLoading(false);
          return;
        }

        const data = snapshot.val();
        if (!data) {
          setResults([]);
          setLoading(false);
          return;
        }

        const completedTopics = Object.entries(data)
          .map(([id, topic]) => ({
            id,
            ...topic,
            matched: topic.responses?.[user.uid]?.response === topic.responses?.[partner.uid]?.response
          }))
          .filter(topic => {
            const belongsToUsers = (
              (topic.createdBy === user.uid && topic.partnerId === partner.uid) ||
              (topic.createdBy === partner.uid && topic.partnerId === user.uid)
            );
            const hasAllResponses = (
              topic.responses?.[user.uid]?.response !== undefined &&
              topic.responses?.[partner.uid]?.response !== undefined
            );
            return belongsToUsers && hasAllResponses;
          })
          .sort((a, b) => {
            const timeA = a.createdAt ? (typeof a.createdAt === 'number' ? a.createdAt : a.createdAt.toMillis?.() || 0) : 0;
            const timeB = b.createdAt ? (typeof b.createdAt === 'number' ? b.createdAt : b.createdAt.toMillis?.() || 0) : 0;
            return timeB - timeA;
          });

        setResults(completedTopics);
        setLoading(false);

        // Calculate stats
        const totalTopics = Object.values(data).filter(topic => 
          (topic.createdBy === user.uid && topic.partnerId === partner.uid) ||
          (topic.createdBy === partner.uid && topic.partnerId === user.uid)
          ).length;

        const matched = completedTopics.filter(topic => topic.matched).length;
        const agreementRate = completedTopics.length > 0 ? (matched / completedTopics.length * 100) : 0;

        setStats({
          totalTopics,
          completedTopics: completedTopics.length,
          pendingTopics: totalTopics - completedTopics.length,
          matchedTopics: matched,
          agreementRate: Math.round(agreementRate)
        });

      } catch (err) {
        console.error('Error processing results:', err);
        setError('Failed to load results. Please try again.');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user?.uid, partner?.uid, isOnline]);

  const handleAddNote = async (resultId) => {
    if (!note.trim() || !isOnline || !partner?.uid || !user?.email || !partner?.email) return;

    setIsSubmitting(true);
    try {
      const topicRef = ref(rtdb, `topics/${resultId}`);
      const noteData = {
        text: note.trim(),
        createdAt: serverTimestamp(),
        isAnonymous: true,
        pairingId: [user.email, partner.email].sort().join('_'), // Use emails for pairing ID
        authorEmail: user.email // Add author's email for reference
      };

      await update(topicRef, {
        notes: {
          [Date.now()]: noteData
        }
      });
      
      setNote('');
    } catch (err) {
      console.error('Error adding note:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRandomSuggestions = (result) => {
    const suggestions = result.matched
      ? SUGGESTIONS.matched[result.responses[user.uid].response ? 'agree' : 'disagree']
      : SUGGESTIONS.mismatched;
    return suggestions.slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 p-4 rounded-lg">
            <p>Error loading results: {error}</p>
            <button 
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show message when not connected
  if (!isOnline || !partner?.email) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black pt-20 pb-24">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Not Connected</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Connect with a partner to see your shared topics and results
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black overflow-y-auto">
      <div className="px-4 lg:px-8 pt-4 pb-28 md:pb-24 space-y-5">
        {/* Header Section */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
              <div className="h-px w-10 bg-gradient-to-r from-blue-500 to-purple-500" />
              Results Overview
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">Results & Insights</h1>
              <p className="mt-2 text-base text-gray-600 dark:text-gray-400 sm:text-lg">
                Get a snapshot of how you and your partner are aligning across topics, and revisit detailed outcomes with actionable suggestions.
              </p>
            </div>
          </div>

          {/* Quick Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 lg:self-start">
            <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-gray-800/70 dark:bg-gray-900/80">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Agreement Rate</span>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{stats.agreementRate.toFixed(1)}%</p>
            </div>
            <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-gray-800/70 dark:bg-gray-900/80">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Completed</span>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{stats.completedTopics}</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: 'Total Topics',
              value: stats.totalTopics,
              description: 'Topics created together',
              icon: ChartBarIcon,
              accent: 'from-blue-500 to-purple-500'
            },
            {
              title: 'Completed',
              value: stats.completedTopics,
              description: 'Decisions made',
              icon: CheckCircleIcon,
              accent: 'from-emerald-500 to-teal-500'
            },
            {
              title: 'In Progress',
              value: stats.pendingTopics,
              description: 'Active discussions',
              icon: ClockIcon,
              accent: 'from-amber-500 to-orange-500'
            },
            {
              title: 'Agreement Rate',
              value: `${stats.agreementRate.toFixed(1)}%`,
              description: 'Overall alignment',
              icon: TagIcon,
              accent: 'from-indigo-500 to-violet-500'
            }
          ].map(({ title, value, description, icon: Icon, accent }) => (
            <div
              key={title}
              className="group relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white/90 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-gray-800/70 dark:bg-gray-900/80"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent} opacity-80`} />
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                <div className="rounded-full bg-gray-100 p-2 text-gray-700 transition group-hover:scale-105 dark:bg-gray-800 dark:text-gray-200">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-semibold text-gray-900 dark:text-white">{value}</p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-800" />

        {/* Results List */}
        <div className="space-y-5">
          {results.length > 0 ? (
            results.map((result, index) => {
              const userResponse = result.responses[user.uid]?.response;
              const partnerResponse = result.responses[partner.uid]?.response;
              const suggestions = getRandomSuggestions(result);
              const notesEntries = result.notes ? Object.entries(result.notes) : [];

              return (
                <article
                  key={result.id}
                  className={`relative overflow-hidden rounded-3xl border border-gray-200/70 bg-white/90 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:border-gray-800/70 dark:bg-gray-900/85 ${
                    selectedResult === result.id ? 'ring-2 ring-primary-500/80' : ''
                  } animate-slide-up`}
                  style={{ animationDelay: `${index * 160}ms` }}
                  onClick={() => setSelectedResult(result.id)}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${
                    result.matched ? 'from-emerald-500 via-emerald-400 to-teal-400' : 'from-rose-500 via-fuchsia-500 to-purple-500'
                  } opacity-80`} />

                  <div className="flex flex-col gap-6">
                    <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full bg-gray-100/70 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800/70 dark:text-gray-300">
                          <TagIcon className="h-4 w-4" />
                          {result.category}
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl flex items-start gap-2">
                          <ChatBubbleLeftRightIcon className="h-6 w-6 text-primary-500" />
                          <span>{result.question}</span>
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center gap-2">
                            <ClockIcon className="h-4 w-4" />
                            {formatDate(result.completedAt || result.createdAt)}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <UserGroupIcon className="h-4 w-4" />
                            {partner.displayName || 'Partner'} &amp; {user.displayName || 'You'}
                          </span>
                          {notesEntries.length > 0 && (
                            <span className="inline-flex items-center gap-2">
                              <ChatBubbleLeftRightIcon className="h-4 w-4" />
                              {notesEntries.length} note{notesEntries.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                        result.matched
                          ? 'border-emerald-400/40 bg-emerald-50 text-emerald-600 dark:border-emerald-400/40 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'border-rose-400/40 bg-rose-50 text-rose-600 dark:border-rose-400/40 dark:bg-rose-900/30 dark:text-rose-300'
                      }`}
                      >
                        {result.matched ? (
                          <CheckCircleIcon className="h-5 w-5" />
                        ) : (
                          <XCircleIcon className="h-5 w-5" />
                        )}
                        {result.matched ? 'Aligned Decisions' : 'Needs Follow-up'}
                      </div>
                    </header>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className={`rounded-2xl border border-gray-200/60 p-5 transition-all duration-200 hover:border-primary-400 hover:shadow-lg dark:border-gray-800/60 dark:hover:border-primary-400/60 ${
                        userResponse ? 'bg-emerald-50/70 dark:bg-emerald-900/20' : 'bg-rose-50/70 dark:bg-rose-900/20'
                      }`}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <UserIcon className="h-4 w-4" />
                          Your Response
                        </p>
                        <p className={`mt-3 flex items-center gap-2 text-2xl font-semibold ${
                          userResponse ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'
                        }`}>
                          {userResponse ? 'Agreed' : 'Disagreed'}
                        </p>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {result.responses[user.uid]?.timestamp ? formatDate(result.responses[user.uid].timestamp) : ''}
                        </p>
                      </div>

                      <div className={`rounded-2xl border border-gray-200/60 p-5 transition-all duration-200 hover:border-primary-400 hover:shadow-lg dark:border-gray-800/60 dark:hover:border-primary-400/60 ${
                        partnerResponse ? 'bg-emerald-50/70 dark:bg-emerald-900/20' : 'bg-rose-50/70 dark:bg-rose-900/20'
                      }`}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <UserGroupIcon className="h-4 w-4" />
                          {partner.displayName || 'Partner'}'s Response
                        </p>
                        <p className={`mt-3 flex items-center gap-2 text-2xl font-semibold ${
                          partnerResponse ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'
                        }`}>
                          {partnerResponse ? 'Agreed' : 'Disagreed'}
                        </p>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {result.responses[partner.uid]?.timestamp ? formatDate(result.responses[partner.uid].timestamp) : ''}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-gray-200/60 bg-gray-50/80 p-5 dark:border-gray-800/60 dark:bg-gray-800/40">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <LightBulbIcon className="h-5 w-5 text-primary-500" />
                          Suggested next steps
                        </h4>
                        <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                          {suggestions.map((tip, tipIndex) => (
                            <li key={tipIndex} className="flex gap-2">
                              <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-primary-400" />
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-2xl border border-gray-200/60 bg-white/70 p-5 dark:border-gray-800/60 dark:bg-gray-900/50">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary-500" />
                            Anonymous Notes
                          </h4>
                          {notesEntries.length > 0 && (
                            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                              {notesEntries.length} shared
                            </span>
                          )}
                        </div>

                        {notesEntries.length > 0 ? (
                          <ul className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1">
                            {notesEntries.map(([key, noteEntry]) => (
                              <li
                                key={key}
                                className="rounded-xl border border-gray-200/40 bg-gray-50/80 p-3 text-sm text-gray-600 transition hover:border-primary-400 dark:border-gray-800/40 dark:bg-gray-800/40 dark:text-gray-300"
                              >
                                <p>{noteEntry.text}</p>
                                <span className="mt-1 block text-xs text-gray-400 dark:text-gray-500">
                                  {formatDate(noteEntry.createdAt)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No notes yet. Share reflections to capture key decisions.</p>
                        )}

                        <div className="mt-4 space-y-3">
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Add an anonymous note..."
                            className="w-full rounded-xl border border-gray-300/70 bg-white/70 p-3 text-sm shadow-sm transition focus:border-primary-500 focus:ring-primary-500 dark:border-gray-700/70 dark:bg-gray-800/70 dark:text-white dark:placeholder-gray-400"
                            rows="3"
                            disabled={!isOnline}
                          />
                          <button
                            onClick={() => handleAddNote(result.id)}
                            className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:shadow-purple-500/20 sm:w-auto ${
                              isSubmitting ? 'opacity-70 cursor-wait' : ''
                            } disabled:opacity-50 disabled:hover:from-blue-600 disabled:hover:to-purple-600`}
                            disabled={!note.trim() || isSubmitting || !isOnline}
                          >
                            <PaperAirplaneIcon className={`h-5 w-5 ${isSubmitting ? 'animate-spin' : ''}`} />
                            {isSubmitting ? 'Sending...' : 'Add Note'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="relative overflow-hidden rounded-3xl border border-dashed border-gray-300/60 bg-white/80 py-16 text-center shadow-sm dark:border-gray-700/60 dark:bg-gray-900/70">
              <div className="absolute inset-x-10 -top-24 h-48 rounded-full bg-gradient-to-b from-blue-500/20 to-purple-500/10 blur-3xl" />
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30">
                <ChartBarIcon className="h-9 w-9" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">No results yet</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Complete some topics together to start building your shared insights.
              </p>
              <div className="mt-8">
                <Link
                  to="/topics"
                  className="inline-flex items-center gap-2 rounded-full border border-transparent bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  <PlusCircleIcon className="h-5 w-5" />
                  Create New Topic
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Results; 