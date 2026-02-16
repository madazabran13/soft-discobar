import React, { useState } from 'react';
import { TableHead } from '@/components/ui/table';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: { key: string; asc: boolean } | null;
  onSort: (key: string) => void;
  className?: string;
}

export const SortableHeader: React.FC<SortableHeaderProps> = ({ label, sortKey, currentSort, onSort, className }) => {
  const isActive = currentSort?.key === sortKey;
  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground transition-colors", className)}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          currentSort.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </div>
    </TableHead>
  );
};

export function useSortableData<T>(data: T[], defaultSort?: { key: string; asc: boolean }) {
  const [sort, setSort] = useState<{ key: string; asc: boolean } | null>(defaultSort || null);

  const toggleSort = (key: string) => {
    setSort(prev => prev?.key === key ? { key, asc: !prev.asc } : { key, asc: true });
  };

  const sorted = React.useMemo(() => {
    if (!sort) return data;
    return [...data].sort((a, b) => {
      const aVal = (a as any)[sort.key];
      const bVal = (b as any)[sort.key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : Number(aVal) - Number(bVal);
      return sort.asc ? cmp : -cmp;
    });
  }, [data, sort]);

  return { sorted, sort, toggleSort };
}
