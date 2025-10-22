import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const TestGenerateCode = () => {
  const { user, generateInviteCode, connectPartner, activeInviteCode } = useAuth();
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  // Test collision detection by generating multiple codes rapidly
  const testCollisions = async () => {
    if (!user) {
      addResult('❌ Must be logged in to test', 'error');
      return;
    }

    setIsRunning(true);
    addResult('🔄 Starting collision test...', 'info');

    const codes = new Set();
    const duplicates = [];
    let errors = 0;

    try {
      for (let i = 0; i < 10; i++) {
        try {
          await generateInviteCode();
          const code = activeInviteCode?.code;
          
          if (code) {
            if (codes.has(code)) {
              duplicates.push(code);
              addResult(`❌ COLLISION DETECTED: ${code}`, 'error');
            } else {
              codes.add(code);
              addResult(`✅ Generated unique code: ${code}`, 'success');
            }
          }
          
          // Wait a bit between generations
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          errors++;
          addResult(`❌ Generation ${i + 1} failed: ${error.message}`, 'error');
        }
      }

      // Summary
      addResult(`\n📊 COLLISION TEST SUMMARY:`, 'info');
      addResult(`Generated: ${codes.size} unique codes`, 'info');
      addResult(`Collisions: ${duplicates.length}`, duplicates.length > 0 ? 'error' : 'success');
      addResult(`Errors: ${errors}`, errors > 0 ? 'error' : 'success');

    } catch (error) {
      addResult(`❌ Collision test failed: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  // Test the timer accuracy
  const testTimer = () => {
    if (!activeInviteCode) {
      addResult('❌ No active invite code to test timer', 'error');
      return;
    }

    addResult('⏱️ Testing timer accuracy...', 'info');
    
    const now = Date.now();
    const expiresAt = activeInviteCode.expiresAt instanceof Date 
      ? activeInviteCode.expiresAt.getTime()
      : activeInviteCode.expiresAt.toMillis();
    
    const frontendRemaining = Math.floor((expiresAt - now) / 1000);
    const minutes = Math.floor(frontendRemaining / 60);
    const seconds = frontendRemaining % 60;

    addResult(`Frontend timer: ${minutes}:${seconds.toString().padStart(2, '0')}`, 'info');
    addResult(`Backend has 1-minute buffer tolerance`, 'warning');
    addResult(`⚠️ Potential mismatch: Frontend exact, backend buffered`, 'warning');
  };

  // Test code format and strength  
  const testCodeGeneration = () => {
    addResult('🧪 Testing code generation algorithm...', 'info');
    
    // Simulate the current algorithm
    const testCodes = [];
    for (let i = 0; i < 100; i++) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      testCodes.push(code);
    }

    const unique = new Set(testCodes);
    const collisionRate = ((testCodes.length - unique.size) / testCodes.length * 100).toFixed(2);

    addResult(`Generated 100 test codes`, 'info');
    addResult(`Unique codes: ${unique.size}`, 'info');
    addResult(`Collision rate: ${collisionRate}%`, collisionRate > 0 ? 'warning' : 'success');
    
    // Test code characteristics
    const hasNumbers = testCodes.some(code => /\d/.test(code));
    const hasLetters = testCodes.some(code => /[A-Z]/.test(code));
    const avgLength = testCodes.reduce((sum, code) => sum + code.length, 0) / testCodes.length;

    addResult(`Contains numbers: ${hasNumbers ? '✅' : '❌'}`, hasNumbers ? 'success' : 'error');
    addResult(`Contains letters: ${hasLetters ? '✅' : '❌'}`, hasLetters ? 'success' : 'error');
    addResult(`Average length: ${avgLength.toFixed(1)} chars`, 'info');

    // Security analysis
    const totalCombinations = Math.pow(36, 6); // 36^6 for base36
    addResult(`Total possible combinations: ${totalCombinations.toLocaleString()}`, 'info');
    addResult(`Birthday paradox 50% collision at ~${Math.sqrt(totalCombinations * Math.PI / 2).toFixed(0)} codes`, 'warning');
  };

  // Test edge cases
  const testEdgeCases = async () => {
    addResult('🔍 Testing edge cases...', 'info');

    // Test self-connection (this should fail)
    if (activeInviteCode) {
      try {
        await connectPartner(activeInviteCode.code);
        addResult('❌ CRITICAL: Self-connection was allowed!', 'error');
      } catch (error) {
        if (error.message.includes('cannot connect with yourself')) {
          addResult('✅ Self-connection properly blocked', 'success');
        } else {
          addResult(`❌ Unexpected error: ${error.message}`, 'error');
        }
      }
    }

    // Test invalid code format
    try {
      await connectPartner('INVALID_CODE_123');
      addResult('❌ Invalid code was accepted!', 'error');
    } catch (error) {
      addResult('✅ Invalid code properly rejected', 'success');
    }

    // Test empty code
    try {
      await connectPartner('');
      addResult('❌ Empty code was accepted!', 'error');
    } catch (error) {
      addResult('✅ Empty code properly rejected', 'success');
    }
  };

  const addResult = (message, type) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, { message, type, timestamp }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getResultStyle = (type) => {
    const baseStyle = "p-2 mb-1 rounded text-sm font-mono";
    switch (type) {
      case 'success': return `${baseStyle} bg-green-100 text-green-800 border border-green-200`;
      case 'error': return `${baseStyle} bg-red-100 text-red-800 border border-red-200`;
      case 'warning': return `${baseStyle} bg-yellow-100 text-yellow-800 border border-yellow-200`;
      case 'info':
      default: return `${baseStyle} bg-blue-100 text-blue-800 border border-blue-200`;
    }
  };

  if (!user) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">🧪 Generate Code Testing</h2>
        <p className="text-gray-600">Please log in to test the generate code functionality.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">🧪 Generate Code Testing Suite</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          onClick={testCollisions}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isRunning ? '🔄 Running...' : '🎯 Test Collisions'}
        </button>
        
        <button
          onClick={testTimer}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          ⏱️ Test Timer
        </button>
        
        <button
          onClick={testCodeGeneration}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          🧪 Test Algorithm
        </button>
        
        <button
          onClick={testEdgeCases}
          className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
        >
          🔍 Test Edge Cases
        </button>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Test Results</h3>
        <button
          onClick={clearResults}
          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
        >
          Clear Results
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded p-4 bg-gray-50">
        {testResults.length === 0 ? (
          <p className="text-gray-500 text-center">No tests run yet. Click a test button above.</p>
        ) : (
          testResults.map((result, index) => (
            <div key={index} className={getResultStyle(result.type)}>
              <span className="text-gray-500 text-xs mr-2">[{result.timestamp}]</span>
              {result.message}
            </div>
          ))
        )}
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Known Issues Found:</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Collision risk with current Math.random() approach</li>
          <li>• No code restoration after browser refresh</li>
          <li>• Race conditions possible with simultaneous connections</li>
          <li>• Timer mismatch between frontend and backend</li>
          <li>• Performance issues with full user collection scan</li>
        </ul>
      </div>

      {activeInviteCode && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
          <h4 className="font-semibold text-green-800 mb-2">Current Active Code:</h4>
          <p className="font-mono text-2xl text-green-700">{activeInviteCode.code}</p>
          <p className="text-sm text-green-600">
            Expires: {new Date(activeInviteCode.expiresAt?.toMillis ? 
              activeInviteCode.expiresAt.toMillis() : 
              activeInviteCode.expiresAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default TestGenerateCode;
