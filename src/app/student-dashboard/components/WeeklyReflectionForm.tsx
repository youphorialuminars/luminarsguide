'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Send, RefreshCw, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ReflectionEntry {
  id: string;
  week_start: string;
  impact_score: number;
  reflection_text: string;
  created_at: string;
}

function getMonday(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Very Low', 2: 'Low', 3: 'Below Average', 4: 'Slightly Below',
  5: 'Average', 6: 'Above Average', 7: 'Good', 8: 'Very Good',
  9: 'Excellent', 10: 'Outstanding',
};

const SCORE_COLOR = (score: number) => {
  if (score <= 3) return '#EF4444';
  if (score <= 5) return '#F59E0B';
  if (score <= 7) return '#6366F1';
  return '#10B981';
};

export default function WeeklyReflectionForm() {
  const { user } = useAuth();
  const [impactScore, setImpactScore] = useState(7);
  const [reflectionText, setReflectionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pastReflections, setPastReflections] = useState<ReflectionEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [thisWeekDone, setThisWeekDone] = useState(false);

  const thisWeek = getMonday(new Date());

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setLoadingHistory(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('mentor_weekly_reflections')
      .select('id, week_start, impact_score, reflection_text, created_at')
      .eq('mentor_id', user.id)
      .order('week_start', { ascending: false })
      .limit(8);
    const entries = data || [];
    setPastReflections(entries);
    setThisWeekDone(entries.some((e) => e.week_start === thisWeek));
    setLoadingHistory(false);
  }, [user, thisWeek]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleSubmit = async () => {
    if (!reflectionText.trim()) {
      toast.error('Please write a brief reflection before submitting.');
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from('mentor_weekly_reflections').insert({
      mentor_id: user!.id,
      week_start: thisWeek,
      impact_score: impactScore,
      reflection_text: reflectionText.trim(),
    });
    if (error) {
      toast.error(error.message || 'Failed to save reflection.');
    } else {
      toast.success('Weekly reflection saved! 🌟');
      setReflectionText('');
      setImpactScore(7);
      fetchHistory();
    }
    setSubmitting(false);
  };

  return (
    <div className="rounded-2xl p-5 card-glow" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--accent-light)' }}
        >
          <Sparkles size={18} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            Weekly Self-Reflection
          </h2>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Rate your impact this week — used in your performance score
          </p>
        </div>
      </div>

      {thisWeekDone ? (
        <div
          className="flex items-center gap-3 p-4 rounded-xl mb-4"
          style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
        >
          <CheckCircle size={18} style={{ color: '#10B981' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#10B981', fontWeight: 700 }}>
              This week&apos;s reflection submitted!
            </p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Week of {formatDate(thisWeek)} — check history below.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Impact Score Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                My Impact This Week
              </label>
              <div className="flex items-center gap-2">
                <span
                  className="text-2xl font-bold"
                  style={{ color: SCORE_COLOR(impactScore), fontWeight: 700 }}
                >
                  {impactScore}
                </span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  / 10 — {SCORE_LABELS[impactScore]}
                </span>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={impactScore}
              onChange={(e) => setImpactScore(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${SCORE_COLOR(impactScore)} ${(impactScore - 1) * 11.1}%, var(--border) ${(impactScore - 1) * 11.1}%)`,
                accentColor: SCORE_COLOR(impactScore),
              }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>1</span>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>10</span>
            </div>
          </div>

          {/* Reflection Text */}
          <div>
            <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
              Reflection Notes
            </label>
            <textarea
              className="input-mystic w-full resize-none"
              rows={3}
              placeholder="What went well this week? What could be improved? How did your students respond?"
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              style={{ minHeight: '80px' }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !reflectionText.trim()}
            className="btn-primary flex items-center gap-2"
          >
            {submitting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            {submitting ? 'Saving...' : 'Submit Reflection'}
          </button>
        </div>
      )}

      {/* History toggle */}
      <button
        onClick={() => setShowHistory((v) => !v)}
        className="flex items-center gap-2 mt-4 text-xs font-medium transition-colors hover:opacity-70"
        style={{ color: 'var(--primary)' }}
      >
        {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showHistory ? 'Hide' : 'View'} Past Reflections ({pastReflections.length})
      </button>

      {showHistory && (
        <div className="mt-3 flex flex-col gap-2">
          {loadingHistory ? (
            <div className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--secondary)' }} />
          ) : pastReflections.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No past reflections yet.</p>
          ) : (
            pastReflections.map((r) => (
              <div
                key={r.id}
                className="p-3 rounded-xl"
                style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                    Week of {formatDate(r.week_start)}
                  </span>
                  <span
                    className="text-sm font-bold px-2 py-0.5 rounded-lg"
                    style={{
                      background: `${SCORE_COLOR(r.impact_score)}18`,
                      color: SCORE_COLOR(r.impact_score),
                    }}
                  >
                    {r.impact_score}/10
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {r.reflection_text}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
