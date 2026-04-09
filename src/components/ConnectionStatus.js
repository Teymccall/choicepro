import React, { useState, useEffect } from 'react';
import { onFirestoreConnectionStateChange, connectionDebugger } from '../firebase/config';

const ConnectionStatus = ({ showDebugPanel = false }) => {
  const [connectionState, setConnectionState] = useState('initializing');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showDetails, setShowDetails] = useState(false);
  const [diagnosis, setDiagnosis] = useState(null);

  useEffect(() => {
    // Monitor Firestore connection state
    const unsubscribe = onFirestoreConnectionStateChange((state) => {
      setConnectionState(state);
    });

    // Monitor browser online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500';
    
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500';
      case 'reconnecting':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'offline':
        return 'Disconnected';
      case 'initializing':
        return 'Initializing...';
      default:
        return 'Unknown';
    }
  };

  const handleDiagnose = () => {
    const result = connectionDebugger.diagnose();
    setDiagnosis(result);
    setShowDetails(true);
  };

  const handleExportLogs = () => {
    const logs = connectionDebugger.exportLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `connection-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!showDebugPanel) {
    // Minimal status indicator
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div 
          className="flex items-center gap-2 bg-white/90 backdrop-blur-sm shadow-lg rounded-full px-4 py-2 border border-gray-200 cursor-pointer hover:shadow-xl transition-shadow"
          onClick={() => setShowDetails(!showDetails)}
        >
          <div className={`w-3 h-3 rounded-full ${getStatusColor()} ${connectionState === 'reconnecting' ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-medium text-gray-700">{getStatusText()}</span>
        </div>

        {showDetails && (
          <div className="absolute bottom-full right-0 mb-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900">Connection Status</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Network:</span>
                <span className={`font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Firestore:</span>
                <span className="font-medium text-gray-900">{connectionState}</span>
              </div>
              
              {navigator.connection && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Connection Type:</span>
                    <span className="font-medium text-gray-900">
                      {navigator.connection.effectiveType || 'Unknown'}
                    </span>
                  </div>
                  {navigator.connection.rtt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Latency:</span>
                      <span className="font-medium text-gray-900">
                        {navigator.connection.rtt}ms
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDiagnose}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Diagnose
              </button>
              <button
                onClick={handleExportLogs}
                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Export Logs
              </button>
            </div>

            {diagnosis && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2">Diagnosis</h4>
                
                {diagnosis.issues.length > 0 ? (
                  <>
                    <div className="mb-3">
                      <p className="text-xs font-medium text-red-600 mb-1">Issues Found:</p>
                      <ul className="text-xs text-gray-700 space-y-1">
                        {diagnosis.issues.map((issue, i) => (
                          <li key={i}>• {issue}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-blue-600 mb-1">Recommendations:</p>
                      <ul className="text-xs text-gray-700 space-y-1">
                        {diagnosis.recommendations.map((rec, i) => (
                          <li key={i}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-green-600">No issues detected</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default ConnectionStatus;
