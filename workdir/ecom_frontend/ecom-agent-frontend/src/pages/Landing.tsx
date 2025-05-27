import { Link } from 'react-router-dom';
import { ShoppingBag, TrendingUp, Users, Shield } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <ShoppingBag className="h-8 w-8 text-indigo-600" />
            <span className="ml-2 text-2xl font-bold text-gray-900">EcomAgent</span>
          </div>
          <div className="flex gap-4">
            <Link to="/signin" className="px-4 py-2 text-gray-700 hover:text-gray-900">
              Sign In
            </Link>
            <Link to="/signup" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <section className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Supercharge Your E-commerce with AI
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
            Harness the power of artificial intelligence to optimize your online store, 
            boost sales, and deliver exceptional customer experiences.
          </p>
          <Link to="/signup" className="inline-flex items-center px-8 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-lg hover:bg-indigo-700">
            Start Free Trial
          </Link>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why Choose EcomAgent?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <TrendingUp className="h-12 w-12 text-indigo-600 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Boost Sales</h3>
              <p className="text-gray-600">
                AI-powered recommendations and personalization increase conversion rates by up to 35%.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <Users className="h-12 w-12 text-indigo-600 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Know Your Customers</h3>
              <p className="text-gray-600">
                Deep insights into customer behavior and preferences to optimize your strategy.
              </p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <Shield className="h-12 w-12 text-indigo-600 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Secure & Reliable</h3>
              <p className="text-gray-600">
                Enterprise-grade security with 99.9% uptime guarantee for your peace of mind.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-4 sm:px-6 lg:px-8 py-12 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <p>&copy; 2024 EcomAgent. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}