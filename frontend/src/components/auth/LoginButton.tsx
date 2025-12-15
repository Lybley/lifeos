'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { Button } from '@/components/ui/Button';
import { LogIn, LogOut, User } from 'lucide-react';

export default function LoginButton() {
  const { user, error, isLoading } = useUser();

  if (isLoading) {
    return <Button variant="outline" disabled>Loading...</Button>;
  }

  if (error) {
    return <div className="text-red-500 text-sm">Error: {error.message}</div>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 md:gap-4">
        <div className="flex items-center gap-2 text-sm">
          {user.picture ? (
            <img 
              src={user.picture} 
              alt={user.name || 'User'} 
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="hidden sm:inline text-gray-700 dark:text-gray-300">
            {user.name || user.email}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (window.location.href = '/api/auth/logout')}
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
      onClick={() => (window.location.href = '/api/auth/login')}
      className="text-xs sm:text-sm px-3 py-2"
    >
      <LogIn className="w-4 h-4 sm:mr-2" />
      <span className="hidden xs:inline">Login</span>
    </Button>
  );
}
