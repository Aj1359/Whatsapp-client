import { cn, STATUS_COLORS } from '../lib/utils';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('badge', STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700')}>
      {status}
    </span>
  );
}

