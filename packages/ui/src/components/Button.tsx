import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils';

/*
 * Adopted from the spotorangeradmin design system (src/components/ui/button.tsx),
 * re-themed for light surfaces. `default` = purple primary, `cta` = lime green.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-heading font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-spoto-purple/40",
  {
    variants: {
      variant: {
        default:
          'bg-spoto-purple text-white hover:bg-spoto-purple-hover shadow-sm hover:shadow-md hover:shadow-spoto-purple/25',
        cta: 'bg-spoto-green text-[#101010] hover:bg-spoto-green-hover shadow-sm hover:shadow-md hover:shadow-spoto-green/30',
        destructive: 'bg-danger text-white hover:bg-danger/90',
        outline:
          'border border-spoto-line bg-spoto-surface text-spoto-ink hover:bg-spoto-surface-2 hover:border-spoto-purple/40',
        secondary: 'bg-spoto-elevated text-spoto-ink hover:bg-spoto-line border border-spoto-line',
        ghost: 'text-spoto-ink hover:bg-spoto-surface-2',
        link: 'text-spoto-purple-ink underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-xl gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-12 rounded-xl px-6 has-[>svg]:px-4',
        xl: 'min-h-14 rounded-xl px-6 text-base has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}
