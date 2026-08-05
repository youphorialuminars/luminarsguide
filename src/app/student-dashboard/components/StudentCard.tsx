import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Calendar, BookOpen, BarChart2, Trash2 } from 'lucide-react';

interface StudentCardProps {
  student: {
    id: string;
    name: string;
    avatar: string;
    lastSession: string | null;
    avgScore: number;
    sessions: number;
    topics: string[];
    trend: string;
    alertLevel: string | null;
  };
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === 'up') return <TrendingUp size={13} style={{ color: '#2E7D32' }} />;
  if (trend === 'down') return <TrendingDown size={13} style={{ color: '#C62828' }} />;
  return <Minus size={13} style={{ color: 'var(--muted-foreground)' }} />;
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

export default function StudentCard({ student, onClick, onDelete }: StudentCardProps) {
  return (
    <div
      className="student-card card-glow group relative"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`View profile for ${student.name}`}
    >
      {/* Delete button */}
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 z-10"
          style={{ background: '#FDECEA', color: '#C62828' }}
          aria-label={`Delete ${student.name}`}
          title="Delete student"
        >
          <Trash2 size={13} />
        </button>
      )}

      {/* Alert banner */}
      {student.alertLevel === 'alert' && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-3 text-xs font-600" style={{ background: '#FDECEA', color: '#C62828', fontWeight: 600 }}>
          <AlertTriangle size={12} />
          Immediate attention needed
        </div>
      )}
      {student.alertLevel === 'warning' && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-3 text-xs font-600" style={{ background: '#FFF8E1', color: '#F57F17', fontWeight: 600 }}>
          <AlertTriangle size={12} />
          Progress declining
        </div>
      )}

      {/* Avatar + name */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0 group-hover:scale-105 transition-transform duration-200"
          style={{ background: 'var(--gradient-primary)', color: 'white' }}
        >
          {student.avatar}
        </div>
        <div className="min-w-0 pr-6">
          <h3 className="text-sm font-700 truncate" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            {student.name}
          </h3>
          <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
            {student.id}
          </p>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-600 uppercase tracking-wide" style={{ color: 'var(--muted-foreground)', fontWeight: 600, letterSpacing: '0.06em' }}>
          Avg Score
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="text-sm font-bold tabular-nums px-2 py-0.5 rounded-lg"
            style={{
              background: scoreBg(student.avgScore),
              color: scoreColor(student.avgScore),
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {student.avgScore}%
          </span>
          <TrendIcon trend={student.trend} />
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 rounded-full mb-4" style={{ background: 'var(--muted)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${student.avgScore}%`,
            background: student.avgScore >= 80 ? '#4CAF50' : student.avgScore >= 60 ? '#FFA726' : '#EF5350',
          }}
        />
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <div className="flex items-center gap-1">
          <BarChart2 size={12} />
          <span>{student.sessions} sessions</span>
        </div>
        <div className="flex items-center gap-1">
          <BookOpen size={12} />
          <span>{student.topics.length} topics</span>
        </div>
      </div>

      {/* Last session */}
      <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <Calendar size={11} />
        <span>{student.lastSession ? `Last: ${student.lastSession}` : 'No sessions yet'}</span>
      </div>

      {/* Topics */}
      <div className="flex flex-wrap gap-1 mt-3">
        {student.topics.slice(0, 2).map((topic) => (
          <span
            key={`${student.id}-topic-${topic}`}
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--secondary)', color: 'var(--primary-dark)', fontWeight: 500 }}
          >
            {topic}
          </span>
        ))}
        {student.topics.length > 2 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
            +{student.topics.length - 2}
          </span>
        )}
      </div>
    </div>
  );
}