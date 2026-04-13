import React from 'react';
import ConnectPartner from '../components/ConnectPartner';
import { useAuth } from '../context/AuthContext';

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

        {/* Partner Connection Section - Always show, component handles both states */}
        <div className="mb-6">
          <ConnectPartner />
        </div>

      </div>
    </div>
  );
};

export default Dashboard;