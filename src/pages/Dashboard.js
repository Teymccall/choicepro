import React from 'react';
import { Link } from 'react-router-dom';
import ConnectPartner from '../components/ConnectPartner';
import { useAuth } from '../context/AuthContext';
import { HeartIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { user, partner } = useAuth();

  return (
    <div className="h-[100dvh] bg-[#fcfcfc] dark:bg-black font-sans text-gray-900 selection:bg-blue-100 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto w-full max-w-lg mx-auto px-5 pt-8 pb-32">

        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-[28px] font-black tracking-tight text-gray-900 dark:text-white leading-[1.1]">
            Welcome back,<br/>
            <span className="text-blue-600 dark:text-blue-400">
              {user?.displayName || user?.email?.split('@')[0] || 'there'}
            </span>
          </h1>
          {partner && (
            <div className="mt-2 text-[14px] font-semibold text-gray-500 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              Connected with <span className="text-gray-900 dark:text-white ml-1">{partner.displayName || partner.email}</span>
            </div>
          )}
        </div>

        {/* Partner Connection Section */}
        {partner && (
          <div className="mb-6">
            <ConnectPartner />
          </div>
        )}

        {/* No Partner Connected State */}
        {!partner && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
              <HeartIcon className="h-8 w-8 text-blue-500" />
            </div>
            <h3 className="text-[17px] font-bold text-gray-900 dark:text-white mb-2">Connect with a Partner</h3>
            <p className="text-[13px] text-gray-400 dark:text-gray-500 mb-6 max-w-[260px]">
              Link up with your partner to start discussing topics and tracking your decisions together.
            </p>
            <Link
              to="/settings"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-xl transition-colors shadow-sm"
            >
              Connect Now <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;