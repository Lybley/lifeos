'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { LogIn, LogOut, User } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface UserData {
  id: string;
  name: string;
  email: string;
}

export default function LoginButton() {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const response = await apiClient.getCurrentUser();
          setUser(response.user);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        // Clear invalid token
        localStorage.removeItem('auth_token');
        localStorage.removeItem('lifeos_user');
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    try {
      await apiClient.logout();
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (isLoading) {
    return <Button variant="outline" disabled>Loading...</Button>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 md:gap-4">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <span className="hidden sm:inline text-gray-700 dark:text-gray-300">
            {user.name || user.email}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="text-xs sm:text-sm"
        >
          <LogOut className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={() => (window.location.href = '/')}
      className="text-xs sm:text-sm px-3 py-2"
    >
      <LogIn className="w-4 h-4 sm:mr-2" />
      <span className="hidden xs:inline">Login</span>
    </Button>
  );
}
