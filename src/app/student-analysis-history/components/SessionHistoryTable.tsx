'use client';
import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface Session {
  id: string;
  date: string;
  topic: string;
  score: number | null;
  model: string;
}

interface SessionHistoryTableProps {
  sessions: Session[];
  studentName: string;
  onViewSession: (sessionId: string) => void;
}

type SortKey = 'date' | 'topic' | 'score';
type SortDir = 'asc' | 'desc';

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 20];

export default function SessionHistoryTable({
  sessions,
  studentName,
  onViewSession,
}: SessionHistoryTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const sorted = [...sessions].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'date') {
      cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (sortKey === 'topic') {
      cmp = a.topic.localeCompare(b.topic);
    } else if (sortKey === 'score') {
      const aScore = a.score ?? -1;
      const bScore = b.score ?? -1;
      cmp = aScore - bScore;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / perPage);
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} style={{ color: 'var(--muted-foreground)' }} />;
    return sortDir === 'asc'
      ? <ArrowUp size={12} style={{ color: 'var(--primary)' }} />
      : <ArrowDown size={12} style={{ color: 'var(--primary)' }} />;
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return '#2E7D32';
    if (score >= 60) return '#F57F17';
    return '#C62828';
  };

  const scoreBg = (score: number) => {
    if (score >= 80) return '#E8F5E9';
    if (score >= 60) return '#FFF8E1';
    return '#FDECEA';
  };

  return (
    <div
      className="rounded-2xl overflow-hidden card-glow"
      style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
    >
      {/* Table header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h3 className="text-sm font-700" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            Session History
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {sessions.length} total sessions for {studentName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Rows:</span>
          <select
            className="input-mystic text-xs"
            style={{ width: '70px', padding: '6px 8px' }}
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            aria-label="Rows per page"
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <option key={`perpage-${opt}`} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr style={{ background: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
              <th className="px-5 py-3 text-left">
                <button
                  type="button"
                  onClick={() => handleSort('date')}
                  className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--muted-foreground)', fontWeight: 600, letterSpacing: '0.06em' }}
                >
                  Date <SortIcon col="date" />
                </button>
              </th>
              <th className="px-5 py-3 text-left">
                <button
                  type="button"
                  onClick={() => handleSort('topic')}
                  className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--muted-foreground)', fontWeight: 600, letterSpacing: '0.06em' }}
                >
                  Topic <SortIcon col="topic" />
                </button>
              </th>
              <th className="px-5 py-3 text-left">
                <button
                  type="button"
                  onClick={() => handleSort('score')}
                  className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-wide hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--muted-foreground)', fontWeight: 600, letterSpacing: '0.06em' }}
                >
                  Score <SortIcon col="score" />
                </button>
              </th>
              <th className="px-5 py-3 text-left">
                <span className="text-xs font-600 uppercase tracking-wide" style={{ color: 'var(--muted-foreground)', fontWeight: 600, letterSpacing: '0.06em' }}>
                  AI Model
                </span>
              </th>
              <th className="px-5 py-3 text-right">
                <span className="text-xs font-600 uppercase tracking-wide" style={{ color: 'var(--muted-foreground)', fontWeight: 600, letterSpacing: '0.06em' }}>
                  Analysis
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center">
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No sessions recorded yet</p>
                </td>
              </tr>
            ) : (
              paginated.map((session, rowIdx) => (
                <tr
                  key={session.id}
                  className="group transition-colors duration-100"
                  style={{
                    background: rowIdx % 2 === 0 ? 'var(--card)' : 'var(--background)',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = 'var(--muted)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      rowIdx % 2 === 0 ? 'var(--card)' : 'var(--background)';
                  }}
                >
                  <td className="px-5 py-3.5">
                    <span className="text-sm tabular-nums" style={{ color: 'var(--foreground)', fontVariantNumeric: 'tabular-nums' }}>
                      {session.date}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className="text-xs font-500 px-2.5 py-1 rounded-full"
                      style={{
                        background: 'var(--secondary)',
                        color: 'var(--primary-dark)',
                        fontWeight: 500,
                      }}
                    >
                      {session.topic}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {session.score !== null ? (
                      <span
                        className="text-sm font-700 tabular-nums px-2.5 py-1 rounded-lg"
                        style={{
                          background: scoreBg(session.score),
                          color: scoreColor(session.score),
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {session.score}/100
                      </span>
                    ) : (
                      <span className="text-xs italic" style={{ color: 'var(--muted-foreground)' }}>
                        Observation only
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={12} style={{ color: 'var(--primary)' }} />
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {session.model}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => onViewSession(session.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-all duration-150 opacity-0 group-hover:opacity-100"
                      style={{
                        background: 'var(--secondary)',
                        color: 'var(--primary-dark)',
                        fontWeight: 600,
                        border: '1px solid var(--border)',
                      }}
                      title="View analysis for this session"
                    >
                      <Eye size={12} />
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-5 py-3 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, sorted.length)} of {sorted.length} sessions
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft size={15} style={{ color: 'var(--foreground)' }} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => setPage(p)}
                className="w-7 h-7 rounded-lg text-xs font-600 transition-all duration-150"
                style={{
                  fontWeight: 600,
                  background: page === p ? 'var(--primary)' : 'transparent',
                  color: page === p ? 'white' : 'var(--muted-foreground)',
                }}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight size={15} style={{ color: 'var(--foreground)' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}