import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TopicChat from '../components/TopicChat';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

const Chat = () => {
  const { partner, user } = useAuth();
  const navigate = useNavigate();

  console.log('Chat component rendered', { partner, user });

  // Create a virtual "topic" for direct messaging with all required properties
  const directChatTopic = React.useMemo(() => ({
    id: 'direct_chat',
    question: 'Direct Chat',
    isDirectChat: true,
    createdBy: user?.uid,
    partnerId: partner?.uid,
    createdAt: Date.now(),
    status: 'active'
  }), [user?.uid, partner?.uid]);

  const handleClose = React.useCallback(() => {
    console.log('Chat handleClose called');
    navigate('/dashboard');
  }, [navigate]);

  if (!partner || !user) {
    console.log('No partner or user, showing empty state');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-black p-4 pb-20 md:pb-4">
        <div className="text-center max-w-md">
          <div className="inline-flex p-4 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-full mb-4">
            <ChatBubbleLeftRightIcon className="h-12 w-12 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            No Partner Connected
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Connect with your partner to start chatting directly!
          </p>
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
