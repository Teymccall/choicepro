import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TopicChat from '../components/TopicChat';
import { ChatBubbleLeftRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

const Chat = () => {
  const { partner, user } = useAuth();
  const navigate = useNavigate();

  console.log('Chat component rendered', { partner, user });

  // Create a unique pairing ID so each partnership has isolated chat messages
  // Sort UIDs to ensure both partners get the same topic ID
  const pairingId = React.useMemo(() => {
    if (!user?.uid || !partner?.uid) return null;
    return [user.uid, partner.uid].sort().join('_');
  }, [user?.uid, partner?.uid]);

  // Create a virtual "topic" for direct messaging with all required properties
  const directChatTopic = React.useMemo(() => ({
    id: pairingId ? `direct_chat_${pairingId}` : 'direct_chat',
    question: 'Direct Chat',
    isDirectChat: true,
    createdBy: user?.uid,
    partnerId: partner?.uid,
    createdAt: Date.now(),
    status: 'active'
  }), [user?.uid, partner?.uid, pairingId]);

  const handleClose = React.useCallback(() => {
    console.log('Chat handleClose called');
    navigate('/dashboard');
  }, [navigate]);

  if (!partner || !user) {
    console.log('No partner or user, showing empty state');
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 pb-20 md:pb-4">
        <div className="text-center max-w-md">
          <div className="inline-flex p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
            <ChatBubbleLeftRightIcon className="h-12 w-12 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            No Partner Connected
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Connect with your partner to start chatting directly!
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full shadow-sm transition-colors duration-200"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  console.log('Rendering TopicChat with topic:', directChatTopic);

  return (
    <div className="h-screen w-full bg-white dark:bg-gray-900 overflow-hidden">
      <TopicChat 
        topic={directChatTopic} 
        onClose={handleClose}
      />
    </div>
  );
};

export default Chat;
