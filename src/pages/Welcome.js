import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const Welcome = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      {/* Hero Section */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-16">
        <div className="text-center">
          {/* Logo with Gradient Background */}
          <div className="flex justify-center mb-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative bg-white p-6 rounded-3xl shadow-2xl transform group-hover:scale-105 transition-transform duration-300">
                <img src="/choice_app_logo.png" alt="Choice Logo" className="h-16 w-16 sm:h-20 sm:w-20" />
              </div>
            </div>
          </div>
          
          {/* Main Heading with Gradient */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black mb-6">
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Make Decisions
            </span>
            <br />
            <span className="text-gray-900">Together</span>
          </h1>
          
          {/* Subheading */}
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect with your partner, explore important topics, and build a stronger relationship through better communication and understanding.
          </p>

          {/* CTA Button */}
          <Link
            to="/dashboard"
            className="group inline-flex items-center px-10 py-5 text-xl font-bold rounded-2xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-xl hover:shadow-2xl transform transition-all duration-300 hover:scale-105 active:scale-95"
          >
            Get Started
            <ArrowRightIcon className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
          </Link>

          {/* Trust Indicators */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">100% Private</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Secure & Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Free Forever</span>
            </div>
          </div>
        </div>
      </div>

      {/* Features - Simple */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="inline-flex p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg mb-4">
              <ShieldCheckIcon className="h-10 w-10 text-white" strokeWidth={2} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">100% Private</h3>
            <p className="text-gray-600">Your conversations stay between you and your partner</p>
          </div>
          
          <div className="text-center">
            <div className="inline-flex p-4 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg mb-4">
              <LockClosedIcon className="h-10 w-10 text-white" strokeWidth={2} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Secure</h3>
            <p className="text-gray-600">End-to-end encryption keeps your data safe</p>
          </div>
          
          <div className="text-center">
            <div className="inline-flex p-4 bg-gradient-to-br from-pink-500 to-red-600 rounded-2xl shadow-lg mb-4">
              <SparklesIcon className="h-10 w-10 text-white" strokeWidth={2} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Simple</h3>
            <p className="text-gray-600">Easy to use, no complicated setup required</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome; 