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
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4" />
          <span className="hidden md:inline">{user.name || user.email}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (window.location.href = '/api/auth/logout')}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={() => (window.location.href = '/api/auth/login')}
    >
      <LogIn className="w-4 h-4 mr-2" />
      Login
    </Button>
  );
}
