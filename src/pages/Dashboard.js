import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ConnectPartner from '../components/ConnectPartner';
import { useAuth } from '../context/AuthContext';
import { 
  ChartBarIcon, 
  PlusCircleIcon, 
  ClockIcon, 
  CheckCircleIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase/config';

const Dashboard = () => {
  const { user, partner, isOnline } = useAuth();
  const [recentTopics, setRecentTopics] = useState([]);
  const [stats, setStats] = useState({
    totalTopics: 0,
    completedTopics: 0,
    pendingTopics: 0,
    agreementRate: 0,
    matchedTopics: 0
  });

  // Fetch recent topics and stats
  useEffect(() => {
    if (!user?.uid || !partner?.uid || !user?.email || !partner?.email) {
      setStats({
        totalTopics: 0,
        completedTopics: 0,
        pendingTopics: 0,
        agreementRate: 0,
        matchedTopics: 0
      });
      return;
    }

    // Create a unique pairing ID using email addresses
    const getPairingId = (email1, email2) => {
      return [email1, email2].sort().join('_');
    };

    const currentPairingId = getPairingId(user.email, partner.email);
    const topicsRef = ref(rtdb, 'topics');
    
    const unsubscribe = onValue(topicsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setStats({
          totalTopics: 0,
          completedTopics: 0,
          pendingTopics: 0,
          agreementRate: 0,
          matchedTopics: 0
        });
        return;
      }

      // Filter topics for current pairing
      const pairTopics = !data ? [] : Object.values(data).filter(topic => {
        const topicPairingId = topic?.initiatorEmail && topic?.initialPartnerEmail ? 
          getPairingId(topic.initiatorEmail, topic.initialPartnerEmail) : null;
        return topicPairingId === currentPairingId;
      });

      // Calculate stats only for current pairing's topics
      const totalTopics = pairTopics.length;
      const completedTopics = !pairTopics ? 0 : pairTopics.filter(topic => 
        topic?.status === 'completed' && 
        topic?.responses?.[user.uid]?.response &&
        topic?.responses?.[partner.uid]?.response
      ).length;

      const matchedTopics = !pairTopics ? 0 : pairTopics.filter(topic => {
        const responses = topic?.responses || {};
        const userResponse = responses[user.uid]?.response;
        const partnerResponse = responses[partner.uid]?.response;
        return userResponse && partnerResponse && userResponse === partnerResponse;
      }).length;

      const pendingTopics = totalTopics - completedTopics;
      const agreementRate = completedTopics > 0 ? (matchedTopics / completedTopics) * 100 : 0;

      setStats({
        totalTopics,
        completedTopics,
        pendingTopics,
        agreementRate,
        matchedTopics
      });
    });

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

  const DashboardCard = ({ icon: Icon, title, value, description, color, extraContent }) => (
    <div className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl border border-gray-100 dark:border-gray-700 p-6 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
      {/* Gradient Background Overlay */}
      <div className={`absolute top-0 right-0 w-32 h-32 ${color} opacity-5 rounded-full blur-3xl group-hover:opacity-10 transition-opacity duration-300`} />
      
      <div className="relative">
        {/* Icon with gradient background */}
        <div className={`inline-flex p-3 rounded-xl ${color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="h-6 w-6 text-white" strokeWidth={2.5} />
        </div>
        
        {/* Content */}
        <div className="mt-4 space-y-1">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
          <p className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500">{description}</p>
          {extraContent}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 dark:from-black dark:via-gray-900 dark:to-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-2">
            <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dashboard</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            Welcome back, <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{user.displayName}</span>!
          </h1>
          {partner && (
            <p className="mt-2 text-base sm:text-lg text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Connected with <span className="font-semibold text-gray-900 dark:text-white">{partner.displayName}</span>
              </span>
            </p>
          )}
        </div>

        {/* Partner Connection Section */}
        <div className="mb-6">
          <ConnectPartner />
        </div>

        {/* Statistics Grid - Only show when partner is connected */}
        {partner && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

            {/* Quick Actions Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Quick Actions</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Get started with these shortcuts</p>
                </div>
                <Link
                  to="/topics"
                  className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg shadow-md hover:shadow-lg text-sm font-semibold text-white transition-all duration-300 hover:scale-105"
                >
                  <PlusCircleIcon className="h-5 w-5 mr-2" strokeWidth={2.5} />
                  New Topic
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                  to="/topics"
                  className="group relative overflow-hidden flex items-center p-5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-blue-200 dark:border-blue-800"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500 opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity" />
                  <div className="relative flex items-center w-full">
                    <div className="flex-shrink-0 p-3 bg-blue-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <ChatBubbleLeftRightIcon className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Discuss Topics</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">View and respond to topics</p>
                    </div>
                  </div>
                </Link>

                <Link
                  to="/results"
                  className="group relative overflow-hidden flex items-center p-5 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-purple-200 dark:border-purple-800"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500 opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity" />
                  <div className="relative flex items-center w-full">
                    <div className="flex-shrink-0 p-3 bg-purple-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <ChartBarIcon className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">View Results</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Track your progress together</p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Recent Activity Section - Placeholder for future implementation */}
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-300">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Activity</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your latest interactions</p>
              </div>
              <div className="text-center py-12">
                <div className="inline-flex p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                  <ChatBubbleLeftRightIcon className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  {stats.totalTopics === 0 
                    ? "No activity yet" 
                    : "Activity feed coming soon"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 max-w-sm mx-auto">
                  {stats.totalTopics === 0 
                    ? "Create your first topic to see your activity timeline here" 
                    : "Your recent decisions and discussions will appear here"}
                </p>
              </div>
            </div>
          </>
        )}

        {/* No Partner Connected State */}
        {!partner && (
          <div className="relative overflow-hidden bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 opacity-5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 opacity-5 rounded-full blur-3xl" />
            
            <div className="relative max-w-md mx-auto">
              <div className="inline-flex p-5 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl mb-6 shadow-lg">
                <ChatBubbleLeftRightIcon className="h-16 w-16 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Connect with Your Partner
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                Start making decisions together by connecting with your partner. Generate a code or search for them to get started.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
                  </div>
                  <span>Generate code</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <span className="text-purple-600 dark:text-purple-400 font-bold">2</span>
                  </div>
                  <span>Share with partner</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <span className="text-green-600 dark:text-green-400 font-bold">3</span>
                  </div>
                  <span>Start deciding</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 