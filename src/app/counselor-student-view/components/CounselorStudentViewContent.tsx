'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Star, Trophy, Calendar, BookOpen, MessageSquare, ChevronLeft, ChevronRight, RefreshCw, Eye } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentInfo {
  id: string;
  name: string;
  grade: string;
  avg_score: number;
  sessions: number;
  primary_topic: string;
  trend: string;
}

interface TierInfo {
  name: string;
  emoji: string;
  color: string;
  bg: string;
  border: string;
  banner: string;
  minScore: number;
}

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  jitsi_url: string;
  notes: string;
}

interface SessionAnalysis {
  id: string;
  topic: string;
  score: number;
  session_date: string;
  strengths: string[];
  weaknesses: string[];
  approach: string[];
  tasks: string[];
  obs_offline_class: string;
  obs_online_task: string;
  obs_group_task: string;
  obs_mentor_call: string;
  obs_comprehensive: string;
}

// ─── Tier Logic ───────────────────────────────────────────────────────────────
const TIERS: TierInfo[] = [
  { name: 'Explorers', emoji: '🧭', color: '#7C6EAA', bg: 'linear-gradient(135deg, #E8E2FF 0%, #D8D0F8 100%)', border: '#A090CC', banner: 'Every great journey begins with curiosity. Keep exploring! 🌟', minScore: 0 },
  { name: 'Pathfinders', emoji: '🗺️', color: '#1565C0', bg: 'linear-gradient(135deg, #E3F2FD 0%, #C8D8F8 100%)', border: '#42A5F5', banner: 'You are finding your path and making real progress. Keep going! 🚀', minScore: 55 },
  { name: 'Trailblazers', emoji: '🔥', color: '#E65100', bg: 'linear-gradient(135deg, #FFF3E0 0%, #FAE8A0 100%)', border: '#FFA726', banner: 'You are blazing the trail for others! Outstanding achievement! 🏆', minScore: 80 },
];

function calculateTier(avgScore: number, sessions: number, attendanceRate: number): TierInfo {
  const composite = (avgScore * 0.5) + (attendanceRate * 0.3) + (Math.min((sessions / 20) * 100, 100) * 0.2);
  if (composite >= 80) return TIERS[2];
  if (composite >= 55) return TIERS[1];
  return TIERS[0];
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function fmtDate(y: number, m: number, d: number) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export default function CounselorStudentViewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const studentId = searchParams.get('studentId') || '';

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [tier, setTier] = useState<TierInfo>(TIERS[0]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [latestSession, setLatestSession] = useState<SessionAnalysis | null>(null);
  const [latestReflection, setLatestReflection] = useState<{ mentor_response: string | null; learned_this_week: string; needs_work: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'report'>('overview');
  const [calYear, setCalYear] = useState(0);
  const [calMonth, setCalMonth] = useState(0);
  const [today, setToday] = useState('');
  const [mentorName, setMentorName] = useState('');

  useEffect(() => {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setToday(fmtDate(now.getFullYear(), now.getMonth(), now.getDate()));
  }, []);

  const loadData = useCallback(async () => {
    if (!user || !studentId) return;
    setLoading(true);
    try {
      const { data: studentData } = await supabase
        .from('students')
        .select('id, name, grade, avg_score, sessions, primary_topic, trend, mentor_id')
        .eq('id', studentId)
        .single();

      if (!studentData) {
        setLoading(false);
        return;
      }

      setStudent(studentData);

      // Get mentor name
      if (studentData.mentor_id) {
        const { data: mentorProfile } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', studentData.mentor_id)
          .single();
        setMentorName(mentorProfile?.full_name || '');
      }

      // Load attendance
      const { data: attData } = await supabase
        .from('attendance')
        .select('attendance_date, status')
        .eq('student_id', studentId);

      const attMap: Record<string, 'present' | 'absent'> = {};
      (attData || []).forEach((a: any) => { attMap[a.attendance_date] = a.status; });
      setAttendance(attMap);

      const total = Object.keys(attMap).length;
      const present = Object.values(attMap).filter((s) => s === 'present').length;
      const attRate = total > 0 ? (present / total) * 100 : 50;
      setTier(calculateTier(studentData.avg_score || 0, studentData.sessions || 0, attRate));

      // Load meetings
      const { data: meetData } = await supabase
        .from('meetings')
        .select('id, title, meeting_date, meeting_time, jitsi_url, notes')
        .eq('student_id', studentId)
        .order('meeting_date', { ascending: true });
      setMeetings(meetData || []);

      // Load latest session
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('id, topic, score, session_date, strengths, weaknesses, approach, tasks, obs_offline_class, obs_online_task, obs_group_task, obs_mentor_call, obs_comprehensive')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setLatestSession(sessionData || null);

      // Load latest reflection
      const { data: reflData } = await supabase
        .from('student_reflections')
        .select('mentor_response, learned_this_week, needs_work')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setLatestReflection(reflData ?? null);

    } catch (err: any) {
      toast.error(err?.message || 'Failed to load student data');
    } finally {
      setLoading(false);
    }
  }, [user, studentId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Calendar ──────────────────────────────────────────────────────────────
  const renderCalendar = () => {
    if (!calYear) return null;
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1); }} className="p-1.5 rounded-lg hover:bg-muted">
            <ChevronLeft size={16} style={{ color: 'var(--muted-foreground)' }} />
          </button>
          <span className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            {MONTHS[calMonth]} {calYear}
          </span>
          <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1); }} className="p-1.5 rounded-lg hover:bg-muted">
            <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS_SHORT.map((d) => (
            <div key={d} className="text-center text-xs font-bold py-1" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;
            const dateStr = fmtDate(calYear, calMonth, day);
            const att = attendance[dateStr];
            const isToday = dateStr === today;
            return (
              <div
                key={dateStr}
                className="aspect-square flex items-center justify-center rounded-lg text-xs font-bold"
                style={{
                  background: att === 'present' ? '#4CAF50' : att === 'absent' ? '#F44336' : isToday ? 'var(--secondary)' : 'transparent',
                  color: att ? 'white' : isToday ? 'var(--primary-dark)' : 'var(--foreground)',
                  fontWeight: 600,
                  border: isToday && !att ? '1.5px solid var(--primary)' : 'none',
                }}
              >
                {day}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ background: '#4CAF50' }} /><span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Present</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ background: '#F44336' }} /><span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Absent</span></div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-16">
        <p style={{ color: 'var(--muted-foreground)' }}>Student not found or access denied.</p>
        <button onClick={() => router.back()} className="btn-secondary mt-4">Go Back</button>
      </div>
    );
  }

  const presentCount = Object.values(attendance).filter((s) => s === 'present').length;
  const totalAtt = Object.keys(attendance).length;

  return (
    <div className="fade-in">
      {/* Read-only banner */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-5"
        style={{ background: 'rgba(155, 142, 196, 0.12)', border: '1px solid rgba(155, 142, 196, 0.3)' }}
      >
        <Eye size={14} style={{ color: 'var(--primary)' }} />
        <span className="text-xs font-bold" style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>
          Read-Only View — You are viewing this student&apos;s profile as a Counselor. No edits can be made.
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft size={18} style={{ color: 'var(--muted-foreground)' }} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{student.name}</h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Grade: {student.grade || 'N/A'} · Mentor: {mentorName || 'Unknown'} · {student.sessions} sessions
          </p>
        </div>
      </div>

      {/* Tier Banner */}
      <div
        className="rounded-2xl p-5 mb-5"
        style={{ background: tier.bg, border: `1.5px solid ${tier.border}` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{tier.emoji}</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: tier.color, fontWeight: 700 }}>
              Quest Tier
            </p>
            <p className="text-xl font-bold" style={{ color: tier.color, fontWeight: 700 }}>{tier.name}</p>
            <p className="text-xs mt-0.5" style={{ color: tier.color, opacity: 0.8 }}>{tier.banner}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-bold" style={{ color: tier.color, fontWeight: 700 }}>{student.avg_score}%</p>
            <p className="text-xs" style={{ color: tier.color, opacity: 0.7 }}>Avg Score</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Sessions', value: student.sessions, icon: BookOpen },
          { label: 'Present', value: `${presentCount}/${totalAtt}`, icon: Trophy },
          { label: 'Avg Score', value: `${student.avg_score}%`, icon: Star },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl p-4 text-center" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
            <Icon size={16} className="mx-auto mb-1.5" style={{ color: 'var(--primary)' }} />
            <p className="text-lg font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>{value}</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'var(--muted)' }}>
        {(['overview', 'calendar', 'report'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all capitalize"
            style={{
              background: activeTab === tab ? 'var(--card)' : 'transparent',
              color: activeTab === tab ? 'var(--primary-dark)' : 'var(--muted-foreground)',
              fontWeight: 700,
              boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab === 'overview' ? 'Mentor Insights' : tab === 'calendar' ? 'Attendance' : 'Reflections'}
          </button>
        ))}
      </div>

      {/* Tab: Mentor Insights */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4">
          {latestSession ? (
            <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Star size={15} style={{ color: 'var(--primary)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                  Latest Session — {latestSession.topic}
                </h3>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent-foreground)' }}>
                  Score: {latestSession.score ?? 'N/A'}%
                </span>
              </div>
              {[
                { label: 'Strengths', items: latestSession.strengths, color: '#4CAF50' },
                { label: 'Weaknesses', items: latestSession.weaknesses, color: '#F44336' },
                { label: 'Approach Required', items: latestSession.approach, color: '#2196F3' },
                { label: 'Task List', items: latestSession.tasks, color: '#FF9800' },
              ].map(({ label, items, color }) => (
                <div key={label} className="mb-3">
                  <p className="text-xs font-bold mb-1.5" style={{ color, fontWeight: 700 }}>{label}</p>
                  <ul className="flex flex-col gap-1">
                    {(items || []).map((item, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--foreground)' }}>
                        <span style={{ color }}>•</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>Observations</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    ['Offline Class', latestSession.obs_offline_class],
                    ['Online Task', latestSession.obs_online_task],
                    ['Group Task', latestSession.obs_group_task],
                    ['Mentor Call', latestSession.obs_mentor_call],
                    ['Comprehensive', latestSession.obs_comprehensive],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="text-xs" style={{ color: 'var(--foreground)' }}>
                      <span className="font-bold" style={{ color: 'var(--primary-dark)' }}>{label}: </span>{value}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--card)', border: '1.5px dashed var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No sessions recorded yet.</p>
            </div>
          )}

          {/* Upcoming meetings */}
          {meetings.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={15} style={{ color: 'var(--primary)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>Upcoming Meetings</h3>
              </div>
              <div className="flex flex-col gap-2">
                {meetings.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--secondary)' }}>
                    <div>
                      <p className="text-xs font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>{m.title}</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{m.meeting_date} at {m.meeting_time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Attendance Calendar */}
      {activeTab === 'calendar' && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
          {renderCalendar()}
        </div>
      )}

      {/* Tab: Reflective Insights */}
      {activeTab === 'report' && (
        <div className="flex flex-col gap-4">
          {latestReflection ? (
            <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={15} style={{ color: 'var(--primary)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>Student Reflections</h3>
              </div>
              {latestReflection.learned_this_week && (
                <div className="mb-3">
                  <p className="text-xs font-bold mb-1" style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>What I Learned</p>
                  <p className="text-xs" style={{ color: 'var(--foreground)' }}>{latestReflection.learned_this_week}</p>
                </div>
              )}
              {latestReflection.needs_work && (
                <div className="mb-3">
                  <p className="text-xs font-bold mb-1" style={{ color: '#E65100', fontWeight: 700 }}>Needs Work</p>
                  <p className="text-xs" style={{ color: 'var(--foreground)' }}>{latestReflection.needs_work}</p>
                </div>
              )}
              {latestReflection.mentor_response && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: '#1565C0', fontWeight: 700 }}>Mentor&apos;s Response</p>
                  <p className="text-xs" style={{ color: 'var(--foreground)' }}>{latestReflection.mentor_response}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--card)', border: '1.5px dashed var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No reflections recorded yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
