import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ConnectPartner from '../components/ConnectPartner';
import { useAuth } from '../context/AuthContext';
import { 
  ChartBarIcon, 
  PlusCircleIcon, 
  ClockIcon, 
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase/config';

const Dashboard = () => {
  const { user, partner, isOnline } = useAuth();
  const [recentTopics, setRecentTopics] = useState([]);
  const [pairTopics, setPairTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoized stats calculation for better performance
  const stats = useMemo(() => {
    if (!pairTopics.length || !user?.uid || !partner?.uid) {
      return {
        totalTopics: 0,
        completedTopics: 0,
        pendingTopics: 0,
        agreementRate: 0,
        matchedTopics: 0
      };
    }

    const totalTopics = pairTopics.length;
    const completedTopics = pairTopics.filter(topic => 
      topic?.status === 'completed' && 
      topic?.responses?.[user.uid]?.response &&
      topic?.responses?.[partner.uid]?.response
    ).length;

    const matchedTopics = pairTopics.filter(topic => {
      const responses = topic?.responses || {};
      const userResponse = responses[user.uid]?.response;
      const partnerResponse = responses[partner.uid]?.response;
      return userResponse && partnerResponse && userResponse === partnerResponse;
    }).length;

    const pendingTopics = totalTopics - completedTopics;
    const agreementRate = completedTopics > 0 ? (matchedTopics / completedTopics) * 100 : 0;

    return {
      totalTopics,
      completedTopics,
      pendingTopics,
      agreementRate,
      matchedTopics
    };
  }, [pairTopics, user?.uid, partner?.uid]);

  // Fetch topics with optimized query
  useEffect(() => {
    if (!user?.uid || !partner?.uid || !user?.email || !partner?.email) {
      setLoading(false);
      setPairTopics([]);
      return;
    }

    setLoading(true);
    setError(null);

    // Create a unique pairing ID using email addresses
    const getPairingId = (email1, email2) => {
      return [email1, email2].sort().join('_');
    };

    const currentPairingId = getPairingId(user.email, partner.email);
    const topicsRef = ref(rtdb, 'topics');
    
    const unsubscribe = onValue(
      topicsRef,
      (snapshot) => {
        try {
          const data = snapshot.val();
          if (!data) {
            setPairTopics([]);
            setLoading(false);
            return;
          }

          // Filter topics for current pairing
          const filteredTopics = Object.values(data).filter(topic => {
            const topicPairingId = topic?.initiatorEmail && topic?.initialPartnerEmail ? 
              getPairingId(topic.initiatorEmail, topic.initialPartnerEmail) : null;
            return topicPairingId === currentPairingId;
          });

          setPairTopics(filteredTopics);
          setLoading(false);
        } catch (err) {
          console.error('Error fetching topics:', err);
          setError(err.message);
          setLoading(false);
        }
      },
      (err) => {
        console.error('Firebase error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Listen for dashboard refresh events
    const handleRefresh = () => {
      console.log('Dashboard refresh event received');
    };
    window.addEventListener('refreshDashboard', handleRefresh);

    return () => {
      unsubscribe();
      window.removeEventListener('refreshDashboard', handleRefresh);
    };
  }, [user?.uid, user?.email, partner?.uid, partner?.email]);

  const DashboardCard = React.memo(({ icon: Icon, title, value, description, color, extraContent }) => (
    <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl border border-gray-100 dark:border-gray-700 p-4 sm:p-3 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
      {/* Gradient Background Overlay */}
      <div className={`absolute top-0 right-0 w-32 h-32 ${color} opacity-5 rounded-full blur-3xl group-hover:opacity-10 transition-opacity duration-300`} />
      
      <div className="relative">
        {/* Icon with gradient background - Responsive */}
        <div className={`inline-flex p-2.5 sm:p-2 rounded-xl ${color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="h-6 w-6 sm:h-5 sm:w-5 text-white" strokeWidth={2.5} />
        </div>
        
        {/* Content - Responsive Typography */}
        <div className="mt-3 sm:mt-2 space-y-1 sm:space-y-0.5">
          <h3 className="text-xs sm:text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
          <p className="text-3xl sm:text-2xl md:text-xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
          <p className="text-sm sm:text-xs text-gray-500 dark:text-gray-500">{description}</p>
          {extraContent}
        </div>
      </div>
    </div>
  ));

  // Loading skeleton
  const DashboardSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-2 mb-4 sm:mb-3">
      {[1,2,3,4].map(i => (
        <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-xl p-4 animate-pulse">
          <div className="h-10 w-10 bg-gray-300 dark:bg-gray-600 rounded-xl mb-3" />
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded mb-2 w-2/3" />
          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded mb-2" />
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
        </div>
      ))}
    </div>
  );

  // Error state
  const ErrorState = ({ error, onRetry }) => (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center mb-4">
      <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Failed to load dashboard</h3>
      <p className="text-sm text-red-700 dark:text-red-300 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
      >
        Retry
      </button>
    </div>
  );

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 dark:from-black dark:via-gray-900 dark:to-black overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3">
        {/* Header Section - Compact */}
        <div className="mb-3">
          <div className="flex items-center space-x-2 mb-1">
            <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dashboard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
            Welcome back, <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{user.displayName}</span>!
          </h1>
          {partner && (
            <p className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Connected with <span className="font-semibold text-gray-900 dark:text-white">{partner.displayName}</span>
              </span>
            </p>
          )}
        </div>

        {/* Partner Connection Section */}
        <div className="mb-3">
          <ConnectPartner />
        </div>

        {/* Statistics Grid - Only show when partner is connected */}
        {partner && (
          <>
            {/* Loading State */}
            {loading && <DashboardSkeleton />}
            
            {/* Error State */}
            {error && <ErrorState error={error} onRetry={() => window.location.reload()} />}
            
            {/* Stats Grid - Responsive */}
            {!loading && !error && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-2 mb-4 sm:mb-3">
              <DashboardCard
                icon={ChatBubbleLeftRightIcon}
                title="Total Topics"
                value={stats.totalTopics}
                description="Created together"
                color="bg-blue-500"
              />
              <DashboardCard
                icon={CheckCircleIcon}
                title="Completed"
                value={stats.completedTopics}
                description="Both decided"
                color="bg-green-500"
              />
              <DashboardCard
                icon={ClockIcon}
                title="Pending"
                value={stats.pendingTopics}
                description="Awaiting response"
                color="bg-yellow-500"
              />
              <DashboardCard
                icon={ChartBarIcon}
                title="Agreement"
                value={`${Math.round(stats.agreementRate)}%`}
                description={`${stats.matchedTopics} matched`}
                color="bg-purple-500"
              />
            </div>
            )}

            {/* Quick Actions Section - Responsive */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Quick Actions</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Get started</p>
                </div>
                <Link
                  to="/topics"
                  className="inline-flex items-center px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg shadow-md hover:shadow-lg text-xs font-semibold text-white transition-all duration-300 hover:scale-105 whitespace-nowrap"
                >
                  <PlusCircleIcon className="h-4 w-4 mr-1" strokeWidth={2.5} />
                  New
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  to="/topics"
                  className="group relative overflow-hidden flex items-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border border-blue-200 dark:border-blue-800"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500 opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity" />
                  <div className="relative flex items-center w-full">
                    <div className="flex-shrink-0 p-2 bg-blue-500 rounded-lg shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" strokeWidth={2.5} />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-xs font-bold text-gray-900 dark:text-white">Discuss Topics</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">View & respond</p>
                    </div>
                  </div>
                </Link>

                <Link
                  to="/results"
                  className="group relative overflow-hidden flex items-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border border-purple-200 dark:border-purple-800"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500 opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity" />
                  <div className="relative flex items-center w-full">
                    <div className="flex-shrink-0 p-2 bg-purple-500 rounded-lg shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <ChartBarIcon className="h-5 w-5 text-white" strokeWidth={2.5} />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-xs font-bold text-gray-900 dark:text-white">View Results</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Track progress</p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </>
        )}

        {/* No Partner Connected State */}
        {!partner && null}
      </div>
    </div>
  );
};

export default Dashboard; 