import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const cardVariants = cva('rounded-lg border bg-white transition-shadow', {
  variants: {
    variant: {
      default: 'border-gray-200 shadow-sm hover:shadow-md',
      elevated: 'border-gray-200 shadow-md hover:shadow-lg',
      outlined: 'border-2 border-gray-300 shadow-none',
      ghost: 'border-transparent shadow-none',
    },
    padding: {
      none: 'p-0',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    },
  },
  defaultVariants: {
    variant: 'default',
    padding: 'md',
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, hoverable, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cardVariants({
          variant,
          padding,
          className: hoverable ? `${className} cursor-pointer` : className,
        })}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={`mb-4 ${className || ''}`} {...props} />;

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  ...props
}) => <h3 className={`text-xl font-semibold text-gray-900 ${className || ''}`} {...props} />;

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => <p className={`text-sm text-gray-600 ${className || ''}`} {...props} />;

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={className} {...props} />;

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={`mt-4 flex items-center gap-2 ${className || ''}`} {...props} />;
