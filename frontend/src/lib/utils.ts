import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ts));
}

export function pct(value: number, total: number): string {
  if (!total) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

export const STATUS_COLORS: Record<string, string> = {
  PENDING:    'bg-gray-100 text-gray-700',
  SENT:       'bg-blue-100 text-blue-700',
  DELIVERED:  'bg-indigo-100 text-indigo-700',
  READ:       'bg-whatsapp-light/20 text-green-700',
  FAILED:     'bg-red-100 text-red-700',
  OPTED_OUT:  'bg-orange-100 text-orange-700',
  DRAFT:      'bg-gray-100 text-gray-700',
  SCHEDULED:  'bg-yellow-100 text-yellow-800',
  SENDING:    'bg-blue-100 text-blue-700',
  DONE:       'bg-green-100 text-green-700',
};

