import React from 'react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'info' | 'warning' | 'error' | 'success';
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className = '', variant = 'default', ...props }, ref) => {
    const variantClasses = {
      default: 'bg-gray-100 text-gray-800 border-gray-300',
      info: 'bg-blue-50 text-blue-800 border-blue-300',
      warning: 'bg-yellow-50 text-yellow-800 border-yellow-300',
      error: 'bg-red-50 text-red-800 border-red-300',
      success: 'bg-green-50 text-green-800 border-green-300',
    };

    return (
      <div
        ref={ref}
        className={`rounded-lg border p-4 ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);

Alert.displayName = 'Alert';

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = '', ...props }, ref) => (
  <p ref={ref} className={`text-sm ${className}`} {...props} />
));

AlertDescription.displayName = 'AlertDescription';
