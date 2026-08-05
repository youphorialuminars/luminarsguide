'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Users, BarChart2, PieChart, Sparkles, RefreshCw, Eye } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { getChatCompletion } from '@/lib/ai/chatCompletion';

interface MentorInfo {
  id: string;
  full_name: string;
  email: string;
  mentor_code: string | null;
}

interface StudentRow {
  id: string;
  name: string;
  avatar: string;
  avg_score: number;
  sessions: number;
  grade: string;
  primary_topic: string;
}

interface SessionRow {
  id: string;
  session_date: string;
  score: number | null;
  topic: string;
  strengths: string[];
  weaknesses: string[];
  obs_offline_class: string;
  obs_online_task: string;
  obs_group_task: string;
  obs_mentor_call: string;
  obs_comprehensive: string;
}

interface FeedbackRow {
  mentor_interaction_score: number;
  active_listening_score: number;
  teaching_clarity_score: number;
  fruitful_comments: string;
  help_needed_comments: string;
}

const PILLAR_COLORS = ['#9B8EC4', '#7BB8D4', '#F0C060', '#A8D8A8', '#F4A0A0'];
const PILLARS = ['Teamwork', 'Digital Hygiene', 'Emotional Resilience', 'Personal Safety', 'Civic Sense'];
const BAR_COLOR = '#9B8EC4';

export default function MentorAnalyticsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const mentorId = searchParams.get('mentorId') || '';

  const [mentor, setMentor] = useState<MentorInfo | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'students'>('overview');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user || !mentorId) return;
    setLoading(true);
    try {
      const [mentorRes, studentsRes, sessionsRes, feedbackRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, full_name, email, mentor_code')
          .eq('id', mentorId)
          .single(),
        supabase
          .from('students')
          .select('id, name, avatar, avg_score, sessions, grade, primary_topic')
          .eq('mentor_id', mentorId),
        supabase
          .from('sessions')
          .select('id, session_date, score, topic, strengths, weaknesses, obs_offline_class, obs_online_task, obs_group_task, obs_mentor_call, obs_comprehensive')
          .eq('mentor_id', mentorId)
          .order('session_date', { ascending: true }),
        supabase
          .from('mentor_feedback')
          .select('mentor_interaction_score, active_listening_score, teaching_clarity_score, fruitful_comments, help_needed_comments')
          .in(
            'student_id',
            (await supabase.from('students').select('id').eq('mentor_id', mentorId)).data?.map((s) => s.id) || []
          ),
      ]);

      setMentor(mentorRes.data || null);
      setStudents(
        (studentsRes.data || []).map((s) => ({
          ...s,
          avatar:
            s.avatar ||
            s.name
              ?.split(' ')
              .map((w: string) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase(),
        }))
      );
      setSessions(sessionsRes.data || []);
      setFeedback(feedbackRes.data || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load mentor data');
    } finally {
      setLoading(false);
    }
  }, [user, mentorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Bar chart: sessions per month ──────────────────────────────────────────
  const sessionVolumeData = (() => {
    const map: Record<string, number> = {};
    sessions.forEach((s) => {
      const label = s.session_date ? s.session_date.slice(0, 7) : 'Unknown';
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([month, count]) => ({ month: month.slice(5), count }));
  })();

  // ── Bar chart: student attendance aggregate ────────────────────────────────
  const attendanceData = students.map((s) => ({
    name: s.name.split(' ')[0],
    sessions: s.sessions,
    score: s.avg_score,
  }));

  // ── Pie chart: pillar distribution ────────────────────────────────────────
  const pillarData = (() => {
    const counts: Record<string, number> = {};
    PILLARS.forEach((p) => (counts[p] = 0));
    sessions.forEach((s) => {
      const topic = s.topic || '';
      PILLARS.forEach((p) => {
        if (topic.toLowerCase().includes(p.toLowerCase())) {
          counts[p] = (counts[p] || 0) + 1;
        }
      });
    });
    return PILLARS.map((p, i) => ({ name: p, value: counts[p] || 0, color: PILLAR_COLORS[i] })).filter(
      (d) => d.value > 0
    );
  })();

  // ── Gemini AI Report ───────────────────────────────────────────────────────
  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    setAiReport(null);
    try {
      const feedbackSummary = feedback
        .map(
          (f, i) =>
            `Feedback ${i + 1}: Interaction=${f.mentor_interaction_score}/10, Listening=${f.active_listening_score}/10, Clarity=${f.teaching_clarity_score}/10. Comments: "${f.fruitful_comments}". Help needed: "${f.help_needed_comments}".`
        )
        .join('\n');

      const sessionSummary = sessions
        .slice(-10)
        .map(
          (s) =>
            `Session on ${s.session_date}: Topic="${s.topic}", Score=${s.score ?? 'N/A'}. Observations: Offline="${s.obs_offline_class}", Online="${s.obs_online_task}", Group="${s.obs_group_task}", Call="${s.obs_mentor_call}", Comprehensive="${s.obs_comprehensive}".`
        )
        .join('\n');

      const prompt = `You are an educational counselor reviewing a mentor's performance. Analyze the following data and provide a structured qualitative performance summary.

Mentor: ${mentor?.full_name}
Total Students: ${students.length}
Total Sessions: ${sessions.length}

Recent Session Logs:
${sessionSummary || 'No sessions recorded yet.'}

Student Feedback:
${feedbackSummary || 'No feedback recorded yet.'}

Please provide a structured report with these four sections:
1. **Overall Strengths** - What the mentor does well based on data
2. **Areas for Improvement** - Specific weaknesses identified
3. **Recommended Approach** - Concrete suggestions for the counselor to guide this mentor
4. **Action Items** - 3-5 specific, actionable next steps

Keep the tone professional, constructive, and evidence-based.`;

      const response = await getChatCompletion(
        'GEMINI',
        'gemini/gemini-2.5-flash',
        [{ role: 'user', content: prompt }],
        { temperature: 0.7, max_tokens: 1200 }
      );

      const content = response?.choices?.[0]?.message?.content || '';
      setAiReport(content);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const initials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className="text-center py-16">
        <p style={{ color: 'var(--muted-foreground)' }}>Mentor not found or access denied.</p>
        <button onClick={() => router.push('/counselor-dashboard')} className="btn-secondary mt-4">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/counselor-dashboard')}
          className="p-2 rounded-xl hover:bg-muted transition-colors"
        >
          <ArrowLeft size={18} style={{ color: 'var(--muted-foreground)' }} />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--gradient-primary)', color: 'white' }}
          >
            {initials(mentor.full_name)}
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
              {mentor.full_name}
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {mentor.email} · {students.length} students · {sessions.length} sessions
            </p>
          </div>
        </div>
        <button
          onClick={handleGenerateReport}
          disabled={generatingReport}
          className="btn-primary flex items-center gap-2"
        >
          {generatingReport ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {generatingReport ? 'Generating...' : 'Generate Performance Report'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'var(--muted)' }}>
        {(['overview', 'students'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all capitalize"
            style={{
              background: activeTab === tab ? 'var(--card)' : 'transparent',
              color: activeTab === tab ? 'var(--primary-dark)' : 'var(--muted-foreground)',
              fontWeight: 700,
              boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab === 'overview' ? 'Analytics Overview' : 'Student Roster'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6">
          {/* AI Report */}
          {aiReport && (
            <div
              className="rounded-2xl p-5 card-glow"
              style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                  AI Performance Report — {mentor.full_name}
                </h3>
              </div>
              <div
                className="text-sm whitespace-pre-wrap leading-relaxed"
                style={{ color: 'var(--foreground)' }}
              >
                {aiReport}
              </div>
            </div>
          )}

          {/* Session Volume Bar Chart */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={16} style={{ color: 'var(--primary)' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                Session Volume Over Time
              </h3>
            </div>
            {sessionVolumeData.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
                No session data available yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sessionVolumeData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: 'var(--foreground)' }}
                  />
                  <Bar dataKey="count" fill={BAR_COLOR} radius={[4, 4, 0, 0]} name="Sessions" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Student Attendance Bar Chart */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} style={{ color: 'var(--primary)' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                Student Session Attendance
              </h3>
            </div>
            {attendanceData.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
                No students assigned yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={attendanceData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: 'var(--foreground)' }}
                  />
                  <Bar dataKey="sessions" fill="#7BB8D4" radius={[4, 4, 0, 0]} name="Sessions" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pillar Distribution Pie Chart */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <PieChart size={16} style={{ color: 'var(--primary)' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                Educational Pillar Distribution
              </h3>
            </div>
            {pillarData.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
                No pillar data available. Sessions need topic tags matching the 5 pillars.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <RechartsPieChart>
                  <Pie
                    data={pillarData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pillarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span style={{ color: 'var(--foreground)', fontSize: '11px' }}>{value}</span>
                    )}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="flex flex-col gap-3">
          {students.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: 'var(--card)', border: '1.5px dashed var(--border)' }}
            >
              <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                No students assigned to this mentor yet.
              </p>
            </div>
          ) : (
            students.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-4 rounded-2xl cursor-pointer hover:opacity-90 transition-opacity"
                style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
                onClick={() => router.push(`/counselor-student-view?studentId=${s.id}`)}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: 'var(--gradient-primary)', color: 'white' }}
                >
                  {s.avatar || initials(s.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                    {s.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Grade: {s.grade || 'N/A'} · Topic: {s.primary_topic || 'General'}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-sm font-bold" style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>
                      {s.avg_score}%
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Avg</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold" style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>
                      {s.sessions}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Sessions</p>
                  </div>
                  <Eye size={14} style={{ color: 'var(--primary)' }} />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
