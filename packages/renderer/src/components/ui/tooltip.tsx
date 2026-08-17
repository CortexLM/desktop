import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-tooltip overflow-hidden rounded-xs bg-primary px-3 py-1.5 text-xs text-primary-foreground',
      'animate-fade-in',
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export interface HintProps {
  /** Tooltip body. Rendering is skipped entirely when this is empty. */
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Delay before showing, ms. 0 suits toolbars where hints should feel instant. */
  delayDuration?: number;
}

/**
 * Hint - single-element tooltip wrapper.
 *
 * The Radix primitives need four nested components (Provider/Root/Trigger/
 * Content) for one hint, which is far too much ceremony for toolbar buttons.
 * This collapses that into `<Hint content="...">{button}</Hint>` and carries
 * its own Provider so callers don't have to remember one.
 *
 * Note this is deliberately *not* named `Tooltip`: that name is already the
 * Radix root, and several views compose the primitives directly.
 */
export function Hint({ content, children, side = 'top', delayDuration = 300 }: HintProps) {
  if (!content) return children;

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
