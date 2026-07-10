import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

import { cn } from '../lib/utils';

/* Adopted from spotorangeradmin design-system inputs, re-themed light. */
const fieldBase =
  'w-full rounded-spoto border border-spoto-line bg-spoto-surface px-4 text-base font-medium text-spoto-ink outline-none transition-colors placeholder:text-spoto-muted focus:border-spoto-purple focus:ring-2 focus:ring-spoto-purple/25';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('min-h-11 py-2', fieldBase, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('min-h-11 py-2', fieldBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('min-h-24 resize-none py-3', fieldBase, className)} {...props} />;
}
