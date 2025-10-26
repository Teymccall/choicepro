import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WebRTCProvider } from './context/WebRTCContext';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import NotificationHandler from './components/NotificationHandler';
import SplashScreen from './components/SplashScreen';
import CallManager from './components/CallManager';
import ConnectionStatus from './components/ConnectionStatus';
import TestGenerateCode from './components/TestGenerateCode';
import { Toaster } from 'react-hot-toast';

// Lazy load components including PrivateRoute
const PrivateRoute = React.lazy(() => import('./components/PrivateRoute'));
const Home = React.lazy(() => import('./pages/Home'));
const Login = React.lazy(() => import('./pages/Login'));
const Signup = React.lazy(() => import('./pages/Signup'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Chat = React.lazy(() => import('./pages/Chat'));
const Topics = React.lazy(() => import('./pages/Topics'));
const Results = React.lazy(() => import('./pages/Results'));
const Settings = React.lazy(() => import('./pages/Settings'));

function App() {
  const [showSplash, setShowSplash] = useState(true);

  // Check if splash has been shown in this session
  useEffect(() => {
    const splashShown = sessionStorage.getItem('splashShown');
    if (splashShown) {
      setShowSplash(false);
    }
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem('splashShown', 'true');
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            style: {
              background: '#2e7d32',
            },
          },
          error: {
            duration: 4000,
            style: {
              background: '#d32f2f',
            },
          },
        }}
      />
      <Router>
        <AuthProvider>
          <WebRTCProvider>
            <NotificationHandler />
            <Layout>
            <React.Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route
                  path="/dashboard"
                  element={
                    <React.Suspense fallback={<LoadingSpinner />}>
                      <PrivateRoute>
                        <Dashboard />
                      </PrivateRoute>
                    </React.Suspense>
                  }
                />
                <Route
                  path="/chat"
                  element={
                    <React.Suspense fallback={<LoadingSpinner />}>
                      <PrivateRoute>
                        <Chat />
                      </PrivateRoute>
                    </React.Suspense>
                  }
                />
                <Route
                  path="/topics"
                  element={
                    <React.Suspense fallback={<LoadingSpinner />}>
                      <PrivateRoute>
                        <Topics />
                      </PrivateRoute>
                    </React.Suspense>
                  }
                />
                <Route
                  path="/results"
                  element={
                    <React.Suspense fallback={<LoadingSpinner />}>
                      <PrivateRoute>
                        <Results />
                      </PrivateRoute>
                    </React.Suspense>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <React.Suspense fallback={<LoadingSpinner />}>
                      <PrivateRoute>
                        <Settings />
                      </PrivateRoute>
                    </React.Suspense>
                  }
                />
                <Route
                  path="/test-generate-code"
                  element={
                    <React.Suspense fallback={<LoadingSpinner />}>
                      <PrivateRoute>
                        <TestGenerateCode />
                      </PrivateRoute>
                    </React.Suspense>
                  }
                />
              </Routes>
            </React.Suspense>
          </Layout>
          </WebRTCProvider>
        </AuthProvider>
      </Router>
    </>
  );
}

export default App;
