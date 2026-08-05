'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, RefreshCw, Star, TrendingUp, Users, BarChart2, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface MentorScore {
  id: string;
  full_name: string;
  email: string;
  // Raw data
  selfReflectionAvg: number | null;   // avg of mentor_weekly_reflections.impact_score (1-10)
  supervisorRating: number | null;    // latest counselor_supervisor_ratings.rating (1-10)
  studentPerformance: number | null;  // avg of students avg_score (0-100)
  studentFeedback: number | null;     // avg of mentor_feedback scores (1-5 → scaled to 1-10)
  // Computed
  overallScore: number;
  rank: number;
}

interface SupervisorRatingForm {
  mentorId: string;
  rating: number;
  notes: string;
}

function computeScore(
  selfReflection: number | null,
  supervisorRating: number | null,
  studentPerformance: number | null,
  studentFeedback: number | null
): number {
  // Normalize all to 0-100 scale
  const s1 = selfReflection != null ? (selfReflection / 10) * 100 : null;
  const s2 = supervisorRating != null ? (supervisorRating / 10) * 100 : null;
  const s3 = studentPerformance; // already 0-100
  const s4 = studentFeedback != null ? (studentFeedback / 5) * 100 : null; // 1-5 → 0-100

  const values = [s1, s2, s3, s4].filter((v): v is number => v != null);
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(Math.min(100, Math.max(0, avg)));
}

function ScoreBar({ value, max = 100, color }: { value: number | null; max?: number; color: string }) {
  const pct = value != null ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
        {value != null ? (max === 10 ? `${value}/10` : max === 5 ? `${value}/5` : `${value}%`) : 'N/A'}
      </span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return (
    <span
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
      style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)', fontWeight: 700 }}
    >
      {rank}
    </span>
  );
}

export default function MentorLeaderboard() {
  const { user } = useAuth();
  const [mentors, setMentors] = useState<MentorScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ratingForm, setRatingForm] = useState<SupervisorRatingForm | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Get all mentors linked to this counselor
      const { data: mentorProfiles, error: mpErr } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('counselor_id', user.id)
        .eq('role', 'mentor');

      if (mpErr) throw mpErr;
      if (!mentorProfiles || mentorProfiles.length === 0) {
        setMentors([]);
        setLoading(false);
        return;
      }

      const mentorIds = mentorProfiles.map((m) => m.id);

      // 2. Fetch self-reflection averages
      const { data: reflections } = await supabase
        .from('mentor_weekly_reflections')
        .select('mentor_id, impact_score')
        .in('mentor_id', mentorIds);

      // 3. Fetch latest supervisor ratings (one per mentor from this counselor)
      const { data: supervisorRatings } = await supabase
        .from('counselor_supervisor_ratings')
        .select('mentor_id, rating')
        .eq('counselor_id', user.id)
        .in('mentor_id', mentorIds)
        .order('created_at', { ascending: false });

      // 4. Fetch student performance (avg_score from students table)
      const { data: students } = await supabase
        .from('students')
        .select('mentor_id, avg_score')
        .in('mentor_id', mentorIds);

      // 5. Fetch student feedback (mentor_feedback table)
      // mentor_feedback has: mentor_interaction_score, active_listening_score, teaching_clarity_score
      // We need to join via students to get mentor_id
      const { data: studentIds } = await supabase
        .from('students')
        .select('id, mentor_id')
        .in('mentor_id', mentorIds);

      const studentIdToMentorId: Record<string, string> = {};
      (studentIds || []).forEach((s) => { studentIdToMentorId[s.id] = s.mentor_id; });

      const allStudentIds = Object.keys(studentIdToMentorId);
      let feedbackData: any[] = [];
      if (allStudentIds.length > 0) {
        const { data: fb } = await supabase
          .from('mentor_feedback')
          .select('student_id, mentor_interaction_score, active_listening_score, teaching_clarity_score')
          .in('student_id', allStudentIds);
        feedbackData = fb || [];
      }

      // ── Aggregate per mentor ──────────────────────────────────────────────
      const scored: MentorScore[] = mentorProfiles.map((m) => {
        // Self-reflection avg
        const myReflections = (reflections || []).filter((r) => r.mentor_id === m.id);
        const selfReflectionAvg = myReflections.length > 0
          ? Math.round(myReflections.reduce((a, r) => a + r.impact_score, 0) / myReflections.length * 10) / 10
          : null;

        // Latest supervisor rating
        const myRatings = (supervisorRatings || []).filter((r) => r.mentor_id === m.id);
        const supervisorRating = myRatings.length > 0 ? myRatings[0].rating : null;

        // Student performance avg
        const myStudents = (students || []).filter((s) => s.mentor_id === m.id);
        const studentPerformance = myStudents.length > 0
          ? Math.round(myStudents.reduce((a, s) => a + (s.avg_score || 0), 0) / myStudents.length)
          : null;

        // Student feedback avg (avg of 3 scores, each 1-5)
        const myStudentIds = (studentIds || []).filter((s) => s.mentor_id === m.id).map((s) => s.id);
        const myFeedback = feedbackData.filter((f) => myStudentIds.includes(f.student_id));
        let studentFeedback: number | null = null;
        if (myFeedback.length > 0) {
          const totalScores = myFeedback.map((f) =>
            ((f.mentor_interaction_score || 0) + (f.active_listening_score || 0) + (f.teaching_clarity_score || 0)) / 3
          );
          studentFeedback = Math.round(totalScores.reduce((a, b) => a + b, 0) / totalScores.length * 10) / 10;
        }

        const overallScore = computeScore(selfReflectionAvg, supervisorRating, studentPerformance, studentFeedback);

        return {
          id: m.id,
          full_name: m.full_name,
          email: m.email,
          selfReflectionAvg,
          supervisorRating,
          studentPerformance,
          studentFeedback,
          overallScore,
          rank: 0,
        };
      });

      // Sort by score descending and assign ranks
      scored.sort((a, b) => b.overallScore - a.overallScore);
      scored.forEach((m, i) => { m.rank = i + 1; });

      setMentors(scored);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handleSubmitRating = async () => {
    if (!ratingForm || !user) return;
    setSubmittingRating(true);
    const supabase = createClient();
    const { error } = await supabase.from('counselor_supervisor_ratings').insert({
      counselor_id: user.id,
      mentor_id: ratingForm.mentorId,
      rating: ratingForm.rating,
      notes: ratingForm.notes,
    });
    if (error) {
      toast.error(error.message || 'Failed to submit rating');
    } else {
      toast.success('Supervisor rating submitted! Leaderboard updated.');
      setRatingForm(null);
      fetchLeaderboard();
    }
    setSubmittingRating(false);
  };

  const initials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const scoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#6366F1';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl p-5 animate-pulse" style={{ background: 'var(--card)', height: '100px' }} />
        ))}
      </div>
    );
  }

  if (mentors.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: 'var(--card)', border: '1.5px dashed var(--border)' }}
      >
        <Trophy size={32} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
        <p className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
          No mentors linked yet
        </p>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Link mentors to your account to see their performance leaderboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div
        className="rounded-xl p-3 flex flex-wrap gap-4"
        style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-1.5">
          <Star size={13} style={{ color: '#6366F1' }} />
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Self-Reflection (1-10)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BarChart2 size={13} style={{ color: '#F59E0B' }} />
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Supervisor Rating (1-10)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp size={13} style={{ color: '#10B981' }} />
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Student Performance (0-100)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users size={13} style={{ color: '#EC4899' }} />
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Student Feedback (1-5)</span>
        </div>
      </div>

      {/* Mentor cards */}
      {mentors.map((mentor) => (
        <div
          key={mentor.id}
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          {/* Main row */}
          <div className="flex items-center gap-4 p-4">
            {/* Rank */}
            <div className="flex-shrink-0 w-8 flex items-center justify-center">
              <RankBadge rank={mentor.rank} />
            </div>

            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: 'var(--gradient-primary)', color: 'white' }}
            >
              {initials(mentor.full_name)}
            </div>

            {/* Name & email */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                {mentor.full_name}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                {mentor.email}
              </p>
            </div>

            {/* Score */}
            <div className="flex-shrink-0 text-right">
              <div
                className="text-2xl font-bold"
                style={{ color: scoreColor(mentor.overallScore), fontWeight: 700 }}
              >
                {mentor.overallScore}
              </div>
              <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>/ 100</div>
            </div>

            {/* Expand toggle */}
            <button
              onClick={() => setExpandedId(expandedId === mentor.id ? null : mentor.id)}
              className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:opacity-70"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {expandedId === mentor.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {/* Score bar */}
          <div className="px-4 pb-3">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${mentor.overallScore}%`,
                  background: `linear-gradient(90deg, ${scoreColor(mentor.overallScore)}, ${scoreColor(mentor.overallScore)}99)`,
                }}
              />
            </div>
          </div>

          {/* Expanded breakdown */}
          {expandedId === mentor.id && (
            <div
              className="px-4 pb-4 pt-2 space-y-3"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                Score Breakdown
              </p>

              <div className="space-y-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Star size={12} style={{ color: '#6366F1' }} />
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Self-Reflection</span>
                  </div>
                  <ScoreBar value={mentor.selfReflectionAvg} max={10} color="#6366F1" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <BarChart2 size={12} style={{ color: '#F59E0B' }} />
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Supervisor Rating</span>
                  </div>
                  <ScoreBar value={mentor.supervisorRating} max={10} color="#F59E0B" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp size={12} style={{ color: '#10B981' }} />
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Student Performance</span>
                  </div>
                  <ScoreBar value={mentor.studentPerformance} max={100} color="#10B981" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users size={12} style={{ color: '#EC4899' }} />
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Student Feedback</span>
                  </div>
                  <ScoreBar value={mentor.studentFeedback} max={5} color="#EC4899" />
                </div>
              </div>

              {/* Supervisor rating form */}
              {ratingForm?.mentorId === mentor.id ? (
                <div
                  className="mt-3 p-3 rounded-xl space-y-3"
                  style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
                >
                  <p className="text-xs font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                    Submit Supervisor Rating for {mentor.full_name}
                  </p>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Rating</label>
                      <span className="text-sm font-bold" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                        {ratingForm.rating}/10
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={ratingForm.rating}
                      onChange={(e) => setRatingForm({ ...ratingForm, rating: Number(e.target.value) })}
                      className="w-full"
                      style={{ accentColor: 'var(--primary)' }}
                    />
                  </div>
                  <textarea
                    className="input-mystic w-full resize-none text-xs"
                    rows={2}
                    placeholder="Optional notes about this rating..."
                    value={ratingForm.notes}
                    onChange={(e) => setRatingForm({ ...ratingForm, notes: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSubmitRating}
                      disabled={submittingRating}
                      className="btn-primary flex items-center gap-1.5 text-xs"
                    >
                      {submittingRating ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                      Submit
                    </button>
                    <button
                      onClick={() => setRatingForm(null)}
                      className="btn-secondary text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setRatingForm({ mentorId: mentor.id, rating: 7, notes: '' })}
                  className="btn-secondary flex items-center gap-1.5 text-xs mt-2"
                >
                  <BarChart2 size={12} />
                  Submit Supervisor Rating
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      <button
        onClick={fetchLeaderboard}
        className="flex items-center gap-2 text-xs font-medium transition-colors hover:opacity-70 mx-auto"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <RefreshCw size={12} />
        Refresh Leaderboard
      </button>
    </div>
  );
}
