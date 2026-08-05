'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, ChevronDown, ChevronUp, Send, RefreshCw,
  Calendar, BookOpen, User, CheckCircle, Clock, Filter, ArrowUpDown
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';


// ─── Types ────────────────────────────────────────────────────────────────────
interface Reflection {
  id: string;
  student_id: string;
  student_name: string;
  week_start: string;
  pillar: string;
  learned_this_week: string;
  needs_work: string;
  team_dynamics: string;
  created_at: string;
  mentor_response: string | null;
  responded_at: string | null;
}

type SortField = 'pillar' | 'date' | 'student';
type SortDir = 'asc' | 'desc';

const PILLARS = [
  'All Pillars',
  'Teamwork and Leadership',
  'Digital Hygiene and Privacy Literacy',
  'Emotional Resilience and Mental Well-being',
  'Personal Safety, Consent, and Boundaries',
  'Civic Sense and Social Responsibility',
];

const PILLAR_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Teamwork and Leadership':                  { bg: '#EDE9FF', text: '#5B21B6', border: '#C4B5FD' },
  'Digital Hygiene and Privacy Literacy':     { bg: '#E0F2FE', text: '#0369A1', border: '#7DD3FC' },
  'Emotional Resilience and Mental Well-being': { bg: '#FCE7F3', text: '#9D174D', border: '#F9A8D4' },
  'Personal Safety, Consent, and Boundaries': { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  'Civic Sense and Social Responsibility':    { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
};

function getPillarStyle(pillar: string) {
  return PILLAR_COLORS[pillar] ?? { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' };
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MentorReflectionsContent() {
  const { user } = useAuth();
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [pillarFilter, setPillarFilter] = useState('All Pillars');
  const [showResponded, setShowResponded] = useState(false);

  const fetchReflections = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    // Fetch all students belonging to this mentor
    const { data: students, error: studErr } = await supabase
      .from('students')
      .select('id, name, primary_topic')
      .eq('mentor_id', user.id);

    if (studErr || !students?.length) {
      setLoading(false);
      setReflections([]);
      return;
    }

    const studentIds = students.map((s) => s.id);
    const studentMap: Record<string, { name: string; topic: string }> = {};
    students.forEach((s) => { studentMap[s.id] = { name: s.name, topic: s.primary_topic }; });

    const { data: rows, error: refErr } = await supabase
      .from('student_reflections')
      .select('id, student_id, week_start, learned_this_week, needs_work, team_dynamics, created_at, mentor_response, responded_at')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false });

    if (refErr) {
      toast.error('Failed to load reflections');
      setLoading(false);
      return;
    }

    const mapped: Reflection[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      student_id: r.student_id,
      student_name: studentMap[r.student_id]?.name ?? 'Unknown Student',
      week_start: r.week_start,
      pillar: studentMap[r.student_id]?.topic ?? 'General',
      learned_this_week: r.learned_this_week,
      needs_work: r.needs_work,
      team_dynamics: r.team_dynamics,
      created_at: r.created_at,
      mentor_response: r.mentor_response ?? null,
      responded_at: r.responded_at ?? null,
    }));

    setReflections(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchReflections();
  }, [fetchReflections]);

  // ─── Sort & Filter ──────────────────────────────────────────────────────────
  const filtered = reflections
    .filter((r) => {
      const matchesPillar = pillarFilter === 'All Pillars' || r.pillar === pillarFilter;
      const matchesStatus = showResponded ? true : !r.mentor_response;
      return matchesPillar && matchesStatus;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === 'pillar') cmp = a.pillar.localeCompare(b.pillar);
      else if (sortField === 'date') cmp = new Date(a.week_start).getTime() - new Date(b.week_start).getTime();
      else if (sortField === 'student') cmp = a.student_name.localeCompare(b.student_name);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const pendingCount = reflections.filter((r) => !r.mentor_response).length;
  const respondedCount = reflections.filter((r) => !!r.mentor_response).length;

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }

  // ─── Submit Response ────────────────────────────────────────────────────────
  async function handleSubmitResponse(reflectionId: string) {
    const text = (responseText[reflectionId] ?? '').trim();
    if (!text) { toast.error('Please write a response before submitting.'); return; }
    setSubmitting(reflectionId);
    const supabase = createClient();
    const { error } = await supabase
      .from('student_reflections')
      .update({ mentor_response: text, responded_at: new Date().toISOString() })
      .eq('id', reflectionId);

    if (error) {
      toast.error('Failed to save response. Please try again.');
    } else {
      toast.success('Response saved and synced to student dashboard.');
      setResponseText((prev) => { const n = { ...prev }; delete n[reflectionId]; return n; });
      setExpandedId(null);
      fetchReflections();
    }
    setSubmitting(null);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            Student Reflections
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Review and respond to reflections submitted by your students
          </p>
        </div>
        <button
          onClick={fetchReflections}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-muted"
          style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} style={{ color: '#F59E0B' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Pending</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{pendingCount}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={16} style={{ color: '#10B981' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Responded</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{respondedCount}</p>
        </div>
        <div className="rounded-xl p-4 col-span-2 sm:col-span-1" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={16} style={{ color: 'var(--primary)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Total</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{reflections.length}</p>
        </div>
      </div>

      {/* Filters & Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Pillar filter */}
        <div className="relative flex-1">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
          <select
            value={pillarFilter}
            onChange={(e) => setPillarFilter(e.target.value)}
            className="w-full pl-8 pr-4 py-2 rounded-lg text-sm appearance-none"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          >
            {PILLARS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Sort buttons */}
        <div className="flex gap-2">
          {(['date', 'pillar', 'student'] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: sortField === field ? 'var(--accent-light)' : 'var(--card)',
                border: `1px solid ${sortField === field ? 'var(--primary)' : 'var(--border)'}`,
                color: sortField === field ? 'var(--primary-dark)' : 'var(--muted-foreground)',
              }}
            >
              <ArrowUpDown size={12} />
              {field.charAt(0).toUpperCase() + field.slice(1)}
              {sortField === field && (
                sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
              )}
            </button>
          ))}
        </div>

        {/* Show responded toggle */}
        <button
          onClick={() => setShowResponded((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: showResponded ? '#D1FAE5' : 'var(--card)',
            border: `1px solid ${showResponded ? '#6EE7B7' : 'var(--border)'}`,
            color: showResponded ? '#065F46' : 'var(--muted-foreground)',
          }}
        >
          <CheckCircle size={13} />
          {showResponded ? 'Showing All' : 'Show Responded'}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--primary)' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading reflections…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <MessageSquare size={40} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
          <p className="font-medium" style={{ color: 'var(--foreground)' }}>
            {reflections.length === 0 ? 'No reflections submitted yet' : 'No reflections match your filters'}
          </p>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {reflections.length === 0
              ? 'Students will appear here once they submit their weekly reflections.' :'Try adjusting the pillar filter or toggle "Show Responded".'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const isExpanded = expandedId === r.id;
            const pillarStyle = getPillarStyle(r.pillar);
            const isResponded = !!r.mentor_response;

            return (
              <div
                key={r.id}
                className="rounded-2xl overflow-hidden transition-shadow"
                style={{
                  background: 'var(--card)',
                  border: `1px solid ${isExpanded ? 'var(--primary)' : 'var(--border)'}`,
                  boxShadow: isExpanded ? '0 4px 20px rgba(124,110,170,0.12)' : undefined,
                }}
              >
                {/* Card header — always visible */}
                <button
                  className="w-full flex items-start gap-4 p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: 'var(--gradient-primary)', color: 'white' }}
                  >
                    {r.student_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                        {r.student_name}
                      </span>
                      {/* Pillar badge */}
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: pillarStyle.bg, color: pillarStyle.text, border: `1px solid ${pillarStyle.border}` }}
                      >
                        {r.pillar}
                      </span>
                      {/* Status badge */}
                      {isResponded ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7' }}>
                          ✓ Responded
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}>
                          ⏳ Pending
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        Week of {formatDate(r.week_start)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        Submitted {formatDate(r.created_at)}
                      </span>
                    </div>
                    {/* Preview of first reflection field */}
                    {!isExpanded && (
                      <p className="text-xs mt-1.5 line-clamp-1" style={{ color: 'var(--muted-foreground)' }}>
                        {r.learned_this_week || '—'}
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="px-4 pb-5 space-y-5 border-t" style={{ borderColor: 'var(--border)' }}>
                    {/* Reflection fields */}
                    <div className="grid sm:grid-cols-1 gap-4 pt-4">
                      <ReflectionField
                        icon={<BookOpen size={14} />}
                        label="What did I learn this week?"
                        value={r.learned_this_week}
                      />
                      <ReflectionField
                        icon={<User size={14} />}
                        label="Which aspects do I need to work on further?"
                        value={r.needs_work}
                      />
                      <ReflectionField
                        icon={<MessageSquare size={14} />}
                        label="How was my team dynamics, and what was the best thing about my team?"
                        value={r.team_dynamics}
                      />
                    </div>

                    {/* Existing mentor response (if any) */}
                    {isResponded && (
                      <div
                        className="rounded-xl p-4"
                        style={{ background: '#F0FDF4', border: '1px solid #6EE7B7' }}
                      >
                        <p className="text-xs font-semibold mb-1" style={{ color: '#065F46' }}>
                          ✓ Your Response — {r.responded_at ? formatDate(r.responded_at) : ''}
                        </p>
                        <p className="text-sm" style={{ color: '#065F46' }}>{r.mentor_response}</p>
                      </div>
                    )}

                    {/* Response form */}
                    <div
                      className="rounded-xl p-4 space-y-3"
                      style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
                    >
                      <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                        {isResponded ? '✏️ Update Your Response' : '💬 Write a Response'}
                      </p>
                      <textarea
                        rows={4}
                        placeholder="Share your feedback, encouragement, or guidance for this student…"
                        value={responseText[r.id] ?? (isResponded ? r.mentor_response ?? '' : '')}
                        onChange={(e) =>
                          setResponseText((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        className="w-full rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none"
                        style={{
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          color: 'var(--foreground)',
                        }}
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleSubmitResponse(r.id)}
                          disabled={submitting === r.id}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
                          style={{ background: 'var(--gradient-primary)', color: 'white' }}
                        >
                          {submitting === r.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Send size={14} />
                          )}
                          {isResponded ? 'Update Response' : 'Send Response'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────
function ReflectionField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span style={{ color: 'var(--primary)' }}>{icon}</span>
        <p className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
      </div>
      <div
        className="rounded-lg px-3 py-2.5 text-sm"
        style={{ background: 'var(--secondary)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
      >
        {value || <span style={{ color: 'var(--muted-foreground)', fontStyle: 'italic' }}>No response provided</span>}
      </div>
    </div>
  );
}
