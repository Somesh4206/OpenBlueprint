import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Visually hide content while keeping it accessible to screen readers.
 * Used to satisfy radix-dialog's required SheetTitle without showing it.
 */
export const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      'absolute size-px overflow-hidden p-0 -m-px whitespace-nowrap border-0 clip-[rect(0,0,0,0)] clip-path-[inset(50%)]',
      className,
    )}
    {...props}
  />
));
VisuallyHidden.displayName = 'VisuallyHidden';
