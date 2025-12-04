'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Shield, Info } from 'lucide-react';

interface PermissionToggleProps {
  scope: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  requiresExplicitConsent: boolean;
  onToggle: (scope: string, enabled: boolean) => Promise<void>;
}

const riskColors = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

const riskIcons = {
  low: Shield,
  medium: Info,
  high: AlertCircle,
  critical: AlertCircle
};

export function PermissionToggle({
  scope,
  name,
  description,
  riskLevel,
  enabled,
  requiresExplicitConsent,
  onToggle
}: PermissionToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(enabled);
  
  const RiskIcon = riskIcons[riskLevel];
  
  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);
    try {
      await onToggle(scope, checked);
      setIsEnabled(checked);
    } catch (error) {
      console.error('Failed to toggle permission:', error);
      // Revert on error
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex items-start space-x-4 p-4 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <Label htmlFor={scope} className="font-medium">
            {name}
          </Label>
          <Badge variant="outline" className={riskColors[riskLevel]}>
            <RiskIcon className="w-3 h-3 mr-1" />
            {riskLevel}
          </Badge>
          {requiresExplicitConsent && (
            <Badge variant="secondary">Explicit Consent Required</Badge>
          )}
        </div>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <div className="flex items-center">
        <Switch
          id={scope}
          checked={isEnabled}
          onCheckedChange={handleToggle}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
