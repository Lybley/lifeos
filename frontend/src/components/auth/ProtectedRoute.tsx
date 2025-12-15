'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check authentication
    const checkAuth = () => {
      try {
        // Check localStorage for user
        const user = localStorage.getItem('lifeos_user');
        const token = localStorage.getItem('lifeos_auth_token');
        
        if (user && token) {
          const userData = JSON.parse(user);
          // Verify the user data is valid
          if (userData.authenticated && userData.email) {
            setIsAuthenticated(true);
            return;
          }
        }
        
        // If no valid auth, redirect to landing page
        setIsAuthenticated(false);
        router.push('/?login=required');
        
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
        router.push('/');
      }
    };

    checkAuth();
  }, [router]);

  // Show loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show nothing (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // If authenticated, render children
  return <>{children}</>;
};
