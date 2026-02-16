import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({ currentPage, totalItems, pageSize, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-sm text-muted-foreground">
        {Math.min((currentPage - 1) * pageSize + 1, totalItems)}–{Math.min(currentPage * pageSize, totalItems)} de {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let page: number;
          if (totalPages <= 5) page = i + 1;
          else if (currentPage <= 3) page = i + 1;
          else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
          else page = currentPage - 2 + i;
          return (
            <Button
              key={page}
              size="sm"
              variant={page === currentPage ? 'default' : 'ghost'}
              className={page === currentPage ? 'gradient-primary' : ''}
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          );
        })}
        <Button size="sm" variant="ghost" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export function usePagination<T>(data: T[], pageSize = 10) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const totalItems = data.length;
  const paged = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  // Reset to page 1 when data changes significantly
  React.useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalItems, pageSize, currentPage]);

  return { paged, currentPage, totalItems, pageSize, setCurrentPage };
}
