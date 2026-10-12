import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../../api/client';
import type { SecurityEvent } from '../../types/api';
import { EmptyState, ErrorState, LoadingState } from '../common/StateView';
import { Pagination } from '../common/Pagination';
import { EventDetailDrawer } from './EventDetailDrawer';
import { Bot, Filter, RefreshCw, Search } from 'lucide-react';

export const EventsTable: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(15);
  const [offset, setOffset] = useState(0);

  const [filterType, setFilterType] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);

  const executeFetch = useCallback((isMountedRef?: { current: boolean }) => {
    return apiClient
      .getEvents({
        limit,
        offset,
        event_type: filterType || undefined,
        source: filterSource || undefined,
        outcome: filterOutcome || undefined,
      })
      .then((data) => {
        if (isMountedRef && !isMountedRef.current) return;
        setEvents(data.items);
        setTotal(data.total);
        setLoading(false);
      })
      .catch((err: any) => {
        if (isMountedRef && !isMountedRef.current) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to fetch events. Please verify backend connection.');
        }
        setLoading(false);
      });
  }, [limit, offset, filterType, filterSource, filterOutcome]);

  const fetchEvents = useCallback(() => {
    setLoading(true);
    setError(null);
    void executeFetch();
  }, [executeFetch]);

  useEffect(() => {
    const isMountedRef = { current: true };
    void executeFetch(isMountedRef);
    return () => {
      isMountedRef.current = false;
    };
  }, [executeFetch]);

  const handleResetFilters = () => {
    setFilterType('');
    setFilterSource('');
    setFilterOutcome('');
    setOffset(0);
  };

  return (
    <div className="panel-card" data-testid="events-page-container">
      <div className="panel-header">
        <h2 className="panel-title">
          <Search size={18} /> Canonical Security Events
        </h2>
        <button
          className="btn btn-secondary"
          onClick={fetchEvents}
          disabled={loading}
          aria-label="Refresh events"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="toolbar-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.85rem' }}>
          <Filter size={14} /> Filters:
        </div>
        <select
          className="select-field"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setOffset(0);
          }}
          aria-label="Filter by event type"
        >
          <option value="">All Event Types</option>
          <option value="Authentication">Authentication</option>
          <option value="IAMPolicyChange">IAMPolicyChange</option>
          <option value="StorageAccess">StorageAccess</option>
        </select>

        <select
          className="select-field"
          value={filterSource}
          onChange={(e) => {
            setFilterSource(e.target.value);
            setOffset(0);
          }}
          aria-label="Filter by source"
        >
          <option value="">All Sources</option>
          <option value="simulator">simulator</option>
          <option value="aws.cloudtrail">aws.cloudtrail</option>
          <option value="aws.guardduty">aws.guardduty</option>
        </select>

        <select
          className="select-field"
          value={filterOutcome}
          onChange={(e) => {
            setFilterOutcome(e.target.value);
            setOffset(0);
          }}
          aria-label="Filter by outcome"
        >
          <option value="">All Outcomes</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILURE">FAILURE</option>
          <option value="DENIED">DENIED</option>
        </select>

        {(filterType || filterSource || filterOutcome) && (
          <button className="btn btn-secondary" onClick={handleResetFilters} style={{ fontSize: '0.8rem' }}>
            Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <LoadingState message="Loading security events from backend..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchEvents} />
      ) : events.length === 0 ? (
        <EmptyState
          title="No events match criteria"
          message="No canonical security events found matching current filter parameters."
          action={
            (filterType || filterSource || filterOutcome) && (
              <button className="btn btn-secondary" onClick={handleResetFilters}>
                Reset Filters
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="table-responsive">
            <table className="data-table" data-testid="events-table">
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Event ID</th>
                  <th>Classification</th>
                  <th>Source</th>
                  <th>Actor</th>
                  <th>Target Resource</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt) => {
                  const isSynth = Boolean(
                    evt.metadata && (evt.metadata.is_synthetic || evt.source === 'simulator')
                  );
                  return (
                    <tr
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      data-testid={`event-row-${evt.event_id}`}
                    >
                      <td className="font-mono" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {new Date(evt.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="font-mono" style={{ color: '#38bdf8', fontWeight: 500 }}>
                        {evt.event_id}
                      </td>
                      <td style={{ fontWeight: 600 }}>{evt.event_type}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          {evt.source}
                          {isSynth && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                background: 'rgba(6, 182, 212, 0.15)',
                                color: '#38bdf8',
                                border: '1px solid rgba(6, 182, 212, 0.4)',
                              }}
                              title="Synthetic simulation telemetry"
                            >
                              <Bot size={10} style={{ display: 'inline', marginRight: 2 }} />
                              SYNTH
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="font-mono" style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={evt.actor || ''}>
                        {evt.actor || '—'}
                      </td>
                      <td className="font-mono" style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={evt.resource || ''}>
                        {evt.resource || '—'}
                      </td>
                      <td>
                        <span className={`badge-outcome ${evt.outcome}`}>{evt.outcome}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            total={total}
            limit={limit}
            offset={offset}
            onPageChange={setOffset}
            disabled={loading}
          />
        </>
      )}

      <EventDetailDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
};
