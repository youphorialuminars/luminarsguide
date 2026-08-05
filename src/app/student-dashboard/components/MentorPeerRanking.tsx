'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, RefreshCw, Star, TrendingUp, Users, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PeerRankingData {
  myScore: {
    selfReflectionAvg: number | null;
    supervisorRating: number | null;
    studentPerformance: number | null;
    studentFeedback: number | null;
    overallScore: number;
  };
  peerAvg: {
    selfReflectionAvg: number | null;
    supervisorRating: number | null;
    studentPerformance: number | null;
    studentFeedback: number | null;
    overallScore: number;
  };
  myRank: number;
  totalMentors: number;
}

function computeScore(
  selfReflection: number | null,
  supervisorRating: number | null,
  studentPerformance: number | null,
  studentFeedback: number | null
): number {
  const s1 = selfReflection != null ? (selfReflection / 10) * 100 : null;
  const s2 = supervisorRating != null ? (supervisorRating / 10) * 100 : null;
  const s3 = studentPerformance;
  const s4 = studentFeedback != null ? (studentFeedback / 5) * 100 : null;
  const values = [s1, s2, s3, s4].filter((v): v is number => v != null);
  if (values.length === 0) return 0;
  return Math.round(Math.min(100, Math.max(0, values.reduce((a, b) => a + b, 0) / values.length)));
}

function ScoreCompareBar({
  myValue,
  peerValue,
  max,
  label,
  icon,
  color,
}: {
  myValue: number | null;
  peerValue: number | null;
  max: number;
  label: string;
  icon: React.ReactNode;
  color: string;
}) {
  const myPct = myValue != null ? Math.round((myValue / max) * 100) : 0;
  const peerPct = peerValue != null ? Math.round((peerValue / max) * 100) : 0;
  const fmt = (v: number | null) =>
    v != null ? (max === 10 ? `${v}/10` : max === 5 ? `${v}/5` : `${v}%`) : 'N/A';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
          {label}
        </span>
      </div>
      {/* My score */}
      <div className="flex items-center gap-2">
        <span className="text-xs w-14 flex-shrink-0" style={{ color: 'var(--primary-dark)' }}>
          You
        </span>
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${myPct}%`, background: color }}
          />
        </div>
        <span className="text-xs font-bold w-10 text-right" style={{ color, fontWeight: 700 }}>
          {fmt(myValue)}
        </span>
      </div>
      {/* Peer avg */}
      <div className="flex items-center gap-2">
        <span className="text-xs w-14 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
          Avg
        </span>
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-700 opacity-50"
            style={{ width: `${peerPct}%`, background: color }}
          />
        </div>
        <span className="text-xs w-10 text-right" style={{ color: 'var(--muted-foreground)' }}>
          {fmt(peerValue)}
        </span>
      </div>
    </div>
  );
}

const scoreColor = (score: number) => {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#6366F1';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
};

export default function MentorPeerRanking() {
  const { user } = useAuth();
  const [data, setData] = useState<PeerRankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    try {
      // ── My scores ──────────────────────────────────────────────────────────
      const { data: myReflections } = await supabase
        .from('mentor_weekly_reflections')
        .select('impact_score')
        .eq('mentor_id', user.id);

      const selfReflectionAvg =
        myReflections && myReflections.length > 0
          ? Math.round(
              (myReflections.reduce((a, r) => a + r.impact_score, 0) / myReflections.length) * 10
            ) / 10
          : null;

      const { data: myRatings } = await supabase
        .from('counselor_supervisor_ratings')
        .select('rating')
        .eq('mentor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const supervisorRating = myRatings && myRatings.length > 0 ? myRatings[0].rating : null;

      const { data: myStudents } = await supabase
        .from('students')
        .select('avg_score')
        .eq('mentor_id', user.id);

      const studentPerformance =
        myStudents && myStudents.length > 0
          ? Math.round(
              myStudents.reduce((a, s) => a + (s.avg_score || 0), 0) / myStudents.length
            )
          : null;

      const { data: myStudentIds } = await supabase
        .from('students')
        .select('id')
        .eq('mentor_id', user.id);

      const sIds = (myStudentIds || []).map((s) => s.id);
      let studentFeedback: number | null = null;
      if (sIds.length > 0) {
        const { data: fb } = await supabase
          .from('mentor_feedback')
          .select('mentor_interaction_score, active_listening_score, teaching_clarity_score')
          .in('student_id', sIds);
        if (fb && fb.length > 0) {
          const totals = fb.map(
            (f) =>
              ((f.mentor_interaction_score || 0) +
                (f.active_listening_score || 0) +
                (f.teaching_clarity_score || 0)) /
              3
          );
          studentFeedback =
            Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10;
        }
      }

      const myOverall = computeScore(
        selfReflectionAvg,
        supervisorRating,
        studentPerformance,
        studentFeedback
      );

      // ── Peer averages (all mentors in same counselor group, anonymized) ────
      const { data: myProfile } = await supabase
        .from('user_profiles')
        .select('counselor_id')
        .eq('id', user.id)
        .single();

      let peerMentorIds: string[] = [];
      if (myProfile?.counselor_id) {
        const { data: peers } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('counselor_id', myProfile.counselor_id)
          .eq('role', 'mentor')
          .neq('id', user.id);
        peerMentorIds = (peers || []).map((p) => p.id);
      }

      let peerSelfReflectionAvg: number | null = null;
      let peerSupervisorRating: number | null = null;
      let peerStudentPerformance: number | null = null;
      let peerStudentFeedback: number | null = null;
      let peerOverall = 0;
      let myRank = 1;
      let totalMentors = 1;

      if (peerMentorIds.length > 0) {
        totalMentors = peerMentorIds.length + 1;

        const { data: peerRefl } = await supabase
          .from('mentor_weekly_reflections')
          .select('mentor_id, impact_score')
          .in('mentor_id', peerMentorIds);

        const { data: peerRatings } = await supabase
          .from('counselor_supervisor_ratings')
          .select('mentor_id, rating')
          .in('mentor_id', peerMentorIds);

        const { data: peerStuds } = await supabase
          .from('students')
          .select('mentor_id, avg_score')
          .in('mentor_id', peerMentorIds);

        const { data: peerStudIds } = await supabase
          .from('students')
          .select('id, mentor_id')
          .in('mentor_id', peerMentorIds);

        const peerStudentIdList = (peerStudIds || []).map((s) => s.id);
        let peerFbData: any[] = [];
        if (peerStudentIdList.length > 0) {
          const { data: pfb } = await supabase
            .from('mentor_feedback')
            .select('student_id, mentor_interaction_score, active_listening_score, teaching_clarity_score')
            .in('student_id', peerStudentIdList);
          peerFbData = pfb || [];
        }

        // Compute per-peer scores
        const peerScores = peerMentorIds.map((pid) => {
          const pr = (peerRefl || []).filter((r) => r.mentor_id === pid);
          const pSelf =
            pr.length > 0
              ? Math.round((pr.reduce((a, r) => a + r.impact_score, 0) / pr.length) * 10) / 10
              : null;

          const pRatings = (peerRatings || []).filter((r) => r.mentor_id === pid);
          const pSup = pRatings.length > 0 ? pRatings[0].rating : null;

          const pStuds = (peerStuds || []).filter((s) => s.mentor_id === pid);
          const pPerf =
            pStuds.length > 0
              ? Math.round(pStuds.reduce((a, s) => a + (s.avg_score || 0), 0) / pStuds.length)
              : null;

          const pSIds = (peerStudIds || []).filter((s) => s.mentor_id === pid).map((s) => s.id);
          const pFb = peerFbData.filter((f) => pSIds.includes(f.student_id));
          let pFeed: number | null = null;
          if (pFb.length > 0) {
            const tots = pFb.map(
              (f) =>
                ((f.mentor_interaction_score || 0) +
                  (f.active_listening_score || 0) +
                  (f.teaching_clarity_score || 0)) /
                3
            );
            pFeed = Math.round((tots.reduce((a, b) => a + b, 0) / tots.length) * 10) / 10;
          }

          return {
            selfReflection: pSelf,
            supervisor: pSup,
            performance: pPerf,
            feedback: pFeed,
            overall: computeScore(pSelf, pSup, pPerf, pFeed),
          };
        });

        // Peer averages
        const avgOf = (arr: (number | null)[]) => {
          const valid = arr.filter((v): v is number => v != null);
          return valid.length > 0
            ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
            : null;
        };

        peerSelfReflectionAvg = avgOf(peerScores.map((p) => p.selfReflection));
        peerSupervisorRating = avgOf(peerScores.map((p) => p.supervisor));
        peerStudentPerformance = avgOf(peerScores.map((p) => p.performance));
        peerStudentFeedback = avgOf(peerScores.map((p) => p.feedback));
        peerOverall = Math.round(
          peerScores.reduce((a, p) => a + p.overall, 0) / peerScores.length
        );

        // Rank: how many peers score higher than me?
        myRank = peerScores.filter((p) => p.overall > myOverall).length + 1;
      }

      setData({
        myScore: {
          selfReflectionAvg,
          supervisorRating,
          studentPerformance,
          studentFeedback,
          overallScore: myOverall,
        },
        peerAvg: {
          selfReflectionAvg: peerSelfReflectionAvg,
          supervisorRating: peerSupervisorRating,
          studentPerformance: peerStudentPerformance,
          studentFeedback: peerStudentFeedback,
          overallScore: peerOverall,
        },
        myRank,
        totalMentors,
      });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load peer ranking');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-5 animate-pulse"
            style={{ background: 'var(--card)', height: '80px' }}
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { myScore, peerAvg, myRank, totalMentors } = data;
  const rankLabel =
    myRank === 1 ? '🥇 Top Mentor!' : myRank === 2 ? '🥈 2nd Place' : myRank === 3 ? '🥉 3rd Place' : `#${myRank}`;

  return (
    <div className="space-y-4">
      {/* Overall score card */}
      <div
        className="rounded-2xl p-5 card-glow"
        style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--secondary)' }}
            >
              <Trophy size={22} style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                Your Performance Score
              </p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {rankLabel} · {totalMentors} mentor{totalMentors !== 1 ? 's' : ''} in your group
              </p>
            </div>
          </div>
          <div className="text-right">
            <div
              className="text-4xl font-bold"
              style={{ color: scoreColor(myScore.overallScore), fontWeight: 700 }}
            >
              {myScore.overallScore}
            </div>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>/ 100</div>
          </div>
        </div>

        {/* Overall bar */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs w-14" style={{ color: 'var(--primary-dark)' }}>You</span>
            <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${myScore.overallScore}%`,
                  background: `linear-gradient(90deg, ${scoreColor(myScore.overallScore)}, ${scoreColor(myScore.overallScore)}99)`,
                }}
              />
            </div>
            <span className="text-xs font-bold w-8 text-right" style={{ color: scoreColor(myScore.overallScore), fontWeight: 700 }}>
              {myScore.overallScore}
            </span>
          </div>
          {totalMentors > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs w-14" style={{ color: 'var(--muted-foreground)' }}>Peer Avg</span>
              <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700 opacity-50"
                  style={{
                    width: `${peerAvg.overallScore}%`,
                    background: `linear-gradient(90deg, ${scoreColor(peerAvg.overallScore)}, ${scoreColor(peerAvg.overallScore)}99)`,
                  }}
                />
              </div>
              <span className="text-xs w-8 text-right" style={{ color: 'var(--muted-foreground)' }}>
                {peerAvg.overallScore}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Breakdown */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
      >
        <button
          onClick={() => setShowBreakdown((v) => !v)}
          className="w-full flex items-center justify-between p-4 hover:opacity-80 transition-opacity"
        >
          <span className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            Score Breakdown vs Peer Average
          </span>
          {showBreakdown ? (
            <ChevronUp size={16} style={{ color: 'var(--muted-foreground)' }} />
          ) : (
            <ChevronDown size={16} style={{ color: 'var(--muted-foreground)' }} />
          )}
        </button>

        {showBreakdown && (
          <div className="px-4 pb-4 space-y-4" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs pt-3" style={{ color: 'var(--muted-foreground)' }}>
              Peer averages are anonymous — no names are shown.
            </p>

            <ScoreCompareBar
              myValue={myScore.selfReflectionAvg}
              peerValue={peerAvg.selfReflectionAvg}
              max={10}
              label="Self-Reflection (1-10)"
              icon={<Star size={13} style={{ color: '#6366F1' }} />}
              color="#6366F1"
            />
            <ScoreCompareBar
              myValue={myScore.supervisorRating}
              peerValue={peerAvg.supervisorRating}
              max={10}
              label="Counselor Feedback (1-10)"
              icon={<BarChart2 size={13} style={{ color: '#F59E0B' }} />}
              color="#F59E0B"
            />
            <ScoreCompareBar
              myValue={myScore.studentPerformance}
              peerValue={peerAvg.studentPerformance}
              max={100}
              label="Student Progress (0-100%)"
              icon={<TrendingUp size={13} style={{ color: '#10B981' }} />}
              color="#10B981"
            />
            <ScoreCompareBar
              myValue={myScore.studentFeedback}
              peerValue={peerAvg.studentFeedback}
              max={5}
              label="Student Feedback (1-5)"
              icon={<Users size={13} style={{ color: '#EC4899' }} />}
              color="#EC4899"
            />
          </div>
        )}
      </div>

      {/* Tips */}
      <div
        className="rounded-xl p-3"
        style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
      >
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          💡 <strong>Tip:</strong> Submit your Weekly Self-Reflection below to improve your Self-Reflection score. Encourage students to leave feedback to boost your Student Feedback score.
        </p>
      </div>

      <button
        onClick={fetchData}
        className="flex items-center gap-2 text-xs font-medium transition-colors hover:opacity-70 mx-auto"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <RefreshCw size={12} />
        Refresh
      </button>
    </div>
  );
}
