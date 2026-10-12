import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (newOffset: number) => void;
  disabled?: boolean;
}

export const Pagination: React.FC<Props> = ({ total, limit, offset, onPageChange, disabled = false }) => {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '1rem',
        padding: '0.5rem 0',
        fontSize: '0.85rem',
        color: '#94a3b8',
      }}
    >
      <div>
        Showing{' '}
        <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
          {total === 0 ? 0 : offset + 1}
        </span>{' '}
        to{' '}
        <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
          {Math.min(offset + limit, total)}
        </span>{' '}
        of <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{total}</span> entries
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          disabled={!hasPrev || disabled}
          aria-label="Previous page"
          style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
        >
          <ChevronLeft size={16} /> Prev
        </button>
        <span style={{ padding: '0 0.5rem', fontWeight: 600, color: '#f1f5f9' }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          className="btn btn-secondary"
          onClick={() => onPageChange(offset + limit)}
          disabled={!hasNext || disabled}
          aria-label="Next page"
          style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
