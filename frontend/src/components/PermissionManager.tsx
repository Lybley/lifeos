'use client';

import { useState, useEffect } from 'react';
import { PermissionToggle } from './PermissionToggle';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Shield, FileText, Calendar, Mail, Users } from 'lucide-react';

interface Scope {
  scope: string;
  name: string;
  description: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  defaultEnabled: boolean;
  requiresExplicitConsent: boolean;
}

interface Permission {
  id: string;
  scope: string;
  status: string;
  grantedAt: string;
}

export function PermissionManager() {
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    loadPermissions();
  }, []);
  
  const loadPermissions = async () => {
    try {
      setLoading(true);
      
      // Load scope definitions
      const scopesRes = await fetch('/api/permissions/scopes');
      const scopesData = await scopesRes.json();
      setScopes(scopesData.scopes || []);
      
      // Load user permissions
      const permsRes = await fetch('/api/permissions/user/permissions');
      const permsData = await permsRes.json();
      setPermissions(permsData.permissions || []);
      
      setError(null);
    } catch (err) {
      setError('Failed to load permissions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggle = async (scope: string, enabled: boolean) => {
    try {
      if (enabled) {
        // Grant permission
        await fetch('/api/permissions/grant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope })
        });
      } else {
        // Revoke permission
        await fetch('/api/permissions/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope })
        });
      }
      
      // Reload permissions
      await loadPermissions();
    } catch (err) {
      console.error('Failed to toggle permission:', err);
      throw err;
    }
  };
  
  const handleRevokeAll = async () => {
    if (!confirm('Are you sure you want to revoke ALL permissions? This will stop all data access.')) {
      return;
    }
    
    try {
      await fetch('/api/permissions/revoke/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'User requested revoke all' })
      });
      
      await loadPermissions();
    } catch (err) {
      console.error('Failed to revoke all permissions:', err);
    }
  };
  
  const isPermissionEnabled = (scope: string) => {
    return permissions.some(p => p.scope === scope && p.status === 'active');
  };
  
  const groupByCategory = (scopes: Scope[]) => {
    return scopes.reduce((acc, scope) => {
      if (!acc[scope.category]) {
        acc[scope.category] = [];
      }
      acc[scope.category].push(scope);
      return acc;
    }, {} as Record<string, Scope[]>);
  };
  
  const categoryIcons: Record<string, any> = {
    email: Mail,
    files: FileText,
    calendar: Calendar,
    contacts: Users,
    messages: Mail,
    health: Shield,
    purchases: AlertCircle
  };
  
  if (loading) {
    return <div className="p-4">Loading permissions...</div>;
  }
  
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  
  const groupedScopes = groupByCategory(scopes);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Data Access Permissions</h2>
          <p className="text-gray-600">Control what data LifeOS can access</p>
        </div>
        <Button
          variant="destructive"
          onClick={handleRevokeAll}
        >
          Revoke All Permissions
        </Button>
      </div>
      
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          These permissions control what data LifeOS can access and process. 
          You can revoke permissions at any time.
        </AlertDescription>
      </Alert>
      
      <Tabs defaultValue={Object.keys(groupedScopes)[0]} className="w-full">
        <TabsList>
          {Object.keys(groupedScopes).map(category => {
            const Icon = categoryIcons[category] || Shield;
            return (
              <TabsTrigger key={category} value={category}>
                <Icon className="w-4 h-4 mr-2" />
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </TabsTrigger>
            );
          })}
        </TabsList>
        
        {Object.entries(groupedScopes).map(([category, categoryScopes]) => (
          <TabsContent key={category} value={category} className="space-y-4">
            {categoryScopes.map(scope => (
              <PermissionToggle
                key={scope.scope}
                scope={scope.scope}
                name={scope.name}
                description={scope.description}
                riskLevel={scope.riskLevel}
                enabled={isPermissionEnabled(scope.scope)}
                requiresExplicitConsent={scope.requiresExplicitConsent}
                onToggle={handleToggle}
              />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
