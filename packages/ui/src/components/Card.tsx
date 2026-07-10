import type { HTMLAttributes } from 'react';

import { cn } from '../lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-spoto border border-spoto-line bg-spoto-surface p-5 shadow-sm shadow-black/5',
        className,
      )}
      {...props}
    />
  );
}
