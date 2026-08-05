'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Star, Trophy, Target, Calendar, BookOpen, MessageSquare, Heart, ChevronLeft, ChevronRight, ExternalLink, Send, Award, TrendingUp, Lightbulb, Eye, AlertCircle, ClipboardList } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import SurveysSection from '../../student-dashboard/components/SurveysSection';
import MyTasks from './MyTasks';
import EmergencyContactWidget from '@/components/EmergencyContactWidget';


// ─── Types ───────────────────────────────────────────────────────────────────
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

interface AttendanceRecord {
  attendance_date: string;
  status: 'present' | 'absent';
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

// ─── Tier Logic ──────────────────────────────────────────────────────────────
const TIERS: TierInfo[] = [
  {
    name: 'Explorers',
    emoji: '🧭',
    color: '#7C6EAA',
    bg: 'linear-gradient(135deg, #E8E2FF 0%, #D8D0F8 100%)',
    border: '#A090CC',
    banner: 'Every great journey begins with curiosity. Keep exploring! 🌟',
    minScore: 0,
  },
  {
    name: 'Pathfinders',
    emoji: '🗺️',
    color: '#1565C0',
    bg: 'linear-gradient(135deg, #E3F2FD 0%, #C8D8F8 100%)',
    border: '#42A5F5',
    banner: 'You are finding your path and making real progress. Keep going! 🚀',
    minScore: 55,
  },
  {
    name: 'Trailblazers',
    emoji: '🔥',
    color: '#E65100',
    bg: 'linear-gradient(135deg, #FFF3E0 0%, #FAE8A0 100%)',
    border: '#FFA726',
    banner: 'You are blazing the trail for others! Outstanding achievement! 🏆',
    minScore: 80,
  },
];

function calculateTier(avgScore: number, sessions: number, attendanceRate: number): TierInfo {
  // Algorithmic assignment: weighted composite score
  const scoreWeight = 0.5;
  const attendanceWeight = 0.3;
  const sessionsWeight = 0.2;
  const maxSessions = 20;
  const sessionScore = Math.min((sessions / maxSessions) * 100, 100);
  const composite = (avgScore * scoreWeight) + (attendanceRate * attendanceWeight) + (sessionScore * sessionsWeight);

  if (composite >= 80) return TIERS[2]; // Trailblazers
  if (composite >= 55) return TIERS[1]; // Pathfinders
  return TIERS[0]; // Explorers
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function fmtDate(y: number, m: number, d: number) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StudentParentDashboardContent() {
  const { user } = useAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'report' | 'feedback' | 'tasks' | 'surveys' | 'parent'>('overview');
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [tier, setTier] = useState<TierInfo>(TIERS[0]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [latestSession, setLatestSession] = useState<SessionAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [calYear, setCalYear] = useState(0);
  const [calMonth, setCalMonth] = useState(0);
  const [today, setToday] = useState('');

  // Reflection form
  const [reflection, setReflection] = useState({ learned: '', needs_work: '', team_dynamics: '' });
  const [savingReflection, setSavingReflection] = useState(false);
  const [latestReflection, setLatestReflection] = useState<{ mentor_response: string | null; responded_at: string | null } | null>(null);

  // Feedback form
  const [feedback, setFeedback] = useState({
    mentor_interaction: 5,
    active_listening: 5,
    teaching_clarity: 5,
    fruitful_comments: '',
    help_needed: '',
  });
  const [savingFeedback, setSavingFeedback] = useState(false);

  // Parent form
  const [parentObs, setParentObs] = useState({ observation: '', program_experience: '' });
  const [suggestion, setSuggestion] = useState('');
  const [savingParent, setSavingParent] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Invite code linking (for unlinked students)
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [linkingCode, setLinkingCode] = useState(false);

  // School code linking
  const [schoolCodeInput, setSchoolCodeInput] = useState('');
  const [linkingSchoolCode, setLinkingSchoolCode] = useState(false);
  const [schoolLinked, setSchoolLinked] = useState(false);

  useEffect(() => {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setToday(fmtDate(now.getFullYear(), now.getMonth(), now.getDate()));
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Find the user's profile to get their linked student_id
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('id, full_name, student_id')
        .eq('id', user.id)
        .single();

      if (!profileData?.student_id) {
        // Fallback: try to find student by student_user_id or student_email matching user email
        const { data: fallbackStudent } = await supabase
          .from('students')
          .select('id, name, grade, avg_score, sessions, primary_topic, trend')
          .or(`student_user_id.eq.${user.id},student_email.eq.${user.email}`)
          .limit(1)
          .maybeSingle();

        if (!fallbackStudent) {
          setLoading(false);
          return;
        }
        setStudent(fallbackStudent);
        // Auto-link the student_id to the profile for future loads
        await supabase.from('user_profiles').update({ student_id: fallbackStudent.id }).eq('id', user.id);
        // Continue with fallbackStudent as studentData
        const studentData = fallbackStudent;
        await loadStudentData(studentData);
        return;
      }

      // Load student by the linked student_id
      const { data: studentData } = await supabase
        .from('students')
        .select('id, name, grade, avg_score, sessions, primary_topic, trend')
        .eq('id', profileData.student_id)
        .single();

      if (!studentData) {
        setLoading(false);
        return;
      }
      setStudent(studentData);

      await loadStudentData(studentData);

    } catch (err: any) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Shared helper: load all data for a resolved student record
  const loadStudentData = async (studentData: StudentInfo) => {
    // Load attendance
    const { data: attData } = await supabase
      .from('attendance')
      .select('attendance_date, status')
      .eq('student_id', studentData.id);

    const attMap: Record<string, 'present' | 'absent'> = {};
    (attData || []).forEach((a: AttendanceRecord) => {
      attMap[a.attendance_date] = a.status;
    });
    setAttendance(attMap);

    // Calculate attendance rate
    const total = Object.keys(attMap).length;
    const present = Object.values(attMap).filter((s) => s === 'present').length;
    const attRate = total > 0 ? (present / total) * 100 : 50;

    // Calculate tier
    const computedTier = calculateTier(studentData.avg_score || 0, studentData.sessions || 0, attRate);
    setTier(computedTier);

    // Load meetings
    const { data: meetData } = await supabase
      .from('meetings')
      .select('id, title, meeting_date, meeting_time, jitsi_url, notes')
      .eq('student_id', studentData.id)
      .order('meeting_date', { ascending: true });
    setMeetings(meetData || []);

    // Load latest session
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('id, topic, score, session_date, strengths, weaknesses, approach, tasks, obs_offline_class, obs_online_task, obs_group_task, obs_mentor_call, obs_comprehensive')
      .eq('student_id', studentData.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatestSession(sessionData || null);

    // Load latest reflection with mentor response
    const { data: reflData } = await supabase
      .from('student_reflections')
      .select('mentor_response, responded_at')
      .eq('student_id', studentData.id)
      .not('mentor_response', 'is', null)
      .order('responded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatestReflection(reflData ?? null);

    // Load leaderboard
    const { data: lbData } = await supabase
      .from('parent_engagement')
      .select('user_id, student_id, observations_count, suggestions_count, total_score, user_profiles(full_name), students(name)')
      .order('total_score', { ascending: false })
      .limit(10);
    setLeaderboard(lbData || []);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Real-time: auto-refresh when mentor updates sessions, attendance, meetings, or reflections ──
  useRealtimeSubscription(
    user && student
      ? [
          { table: 'sessions',            filter: `student_id=eq.${student.id}`, onRefresh: loadData },
          { table: 'attendance',          filter: `student_id=eq.${student.id}`, onRefresh: loadData },
          { table: 'meetings',            filter: `student_id=eq.${student.id}`, onRefresh: loadData },
          { table: 'student_reflections', filter: `student_id=eq.${student.id}`, onRefresh: loadData },
        ]
      : []
  );

  // ─── Calendar render ────────────────────────────────────────────────────────
  const renderCalendar = () => {
    if (!calYear) return null;
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const upcomingMeetings = meetings.filter((m) => {
      const md = m.meeting_date;
      const [my, mm] = md.split('-').map(Number);
      return my === calYear && mm === calMonth + 1;
    });

    return (
      <div>
        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }} className="p-2 rounded-lg hover:bg-muted">
            <ChevronLeft size={16} style={{ color: 'var(--muted-foreground)' }} />
          </button>
          <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
            {MONTHS[calMonth]} {calYear}
          </span>
          <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }} className="p-2 rounded-lg hover:bg-muted">
            <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_SHORT.map((d) => (
            <div key={d} className="text-center text-xs font-600 py-1" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;
            const dateKey = fmtDate(calYear, calMonth, day);
            const att = attendance[dateKey];
            const hasMeeting = upcomingMeetings.some((m) => m.meeting_date === dateKey);
            const isToday = dateKey === today;

            let bg = 'transparent';
            let color = 'var(--foreground)';
            if (att === 'present') { bg = '#D4EDDA'; color = '#2E7D32'; }
            else if (att === 'absent') { bg = '#FADADD'; color = '#C62828'; }

            return (
              <div
                key={dateKey}
                className="relative flex flex-col items-center justify-center rounded-lg p-1 min-h-[36px] text-xs"
                style={{
                  background: bg,
                  color,
                  border: isToday ? '2px solid var(--primary)' : '1px solid transparent',
                  fontWeight: isToday ? 700 : 400,
                }}
              >
                {day}
                {hasMeeting && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: '#7C6EAA' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: '#D4EDDA' }} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: '#FADADD' }} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#7C6EAA' }} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Meeting</span>
          </div>
        </div>

        {/* Upcoming meetings */}
        {upcomingMeetings.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-600 mb-2" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
              Meetings this month:
            </p>
            <div className="flex flex-col gap-2">
              {upcomingMeetings.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
                >
                  <div>
                    <p className="text-xs font-600" style={{ color: 'var(--foreground)', fontWeight: 600 }}>{m.title}</p>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {m.meeting_date} at {m.meeting_time}
                    </p>
                  </div>
                  {m.jitsi_url && (
                    <a
                      href={m.jitsi_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-600 px-3 py-1.5 rounded-lg"
                      style={{ background: 'var(--primary)', color: 'white', fontWeight: 600 }}
                    >
                      <ExternalLink size={12} />
                      Join
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Save reflection ────────────────────────────────────────────────────────
  const saveReflection = async () => {
    if (!student || !user) return;
    if (!reflection.learned && !reflection.needs_work && !reflection.team_dynamics) {
      toast.error('Please fill in at least one reflection field');
      return;
    }
    setSavingReflection(true);
    try {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const { error } = await supabase.from('student_reflections').insert({
        student_id: student.id,
        user_id: user.id,
        week_start: weekStart.toISOString().split('T')[0],
        learned_this_week: reflection.learned,
        needs_work: reflection.needs_work,
        team_dynamics: reflection.team_dynamics,
      });
      if (error) throw error;
      toast.success('Reflection saved! Your mentor can now see it. ✨');
      setReflection({ learned: '', needs_work: '', team_dynamics: '' });
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSavingReflection(false);
    }
  };

  // ─── Save feedback ──────────────────────────────────────────────────────────
  const saveFeedback = async () => {
    if (!student || !user) return;
    setSavingFeedback(true);
    try {
      const { error } = await supabase.from('mentor_feedback').insert({
        student_id: student.id,
        submitted_by: user.id,
        mentor_interaction_score: feedback.mentor_interaction,
        active_listening_score: feedback.active_listening,
        teaching_clarity_score: feedback.teaching_clarity,
        fruitful_comments: feedback.fruitful_comments,
        help_needed_comments: feedback.help_needed,
      });
      if (error) throw error;
      toast.success('Feedback submitted! Thank you. 🙏');
      setFeedback({ mentor_interaction: 5, active_listening: 5, teaching_clarity: 5, fruitful_comments: '', help_needed: '' });
    } catch (err: any) {
      toast.error('Failed to submit: ' + err.message);
    } finally {
      setSavingFeedback(false);
    }
  };

  // ─── Save parent observation ────────────────────────────────────────────────
  const saveParentObservation = async () => {
    if (!student || !user) return;
    if (!parentObs.observation) {
      toast.error('Please enter your observation');
      return;
    }
    setSavingParent(true);
    try {
      const { error } = await supabase.from('parent_observations').insert({
        student_id: student.id,
        submitted_by: user.id,
        observation_text: parentObs.observation,
        program_experience: parentObs.program_experience,
      });
      if (error) throw error;

      // Update engagement score
      await supabase.rpc('increment_parent_engagement', {
        p_user_id: user.id,
        p_student_id: student.id,
        p_type: 'observation',
      }).catch(() => {
        // RPC may not exist yet, update manually
        supabase.from('parent_engagement').upsert({
          user_id: user.id,
          student_id: student.id,
          observations_count: 1,
          total_score: 10,
        }, { onConflict: 'user_id' });
      });

      toast.success('Observation submitted! 💚');
      setParentObs({ observation: '', program_experience: '' });
      loadData();
    } catch (err: any) {
      toast.error('Failed to submit: ' + err.message);
    } finally {
      setSavingParent(false);
    }
  };

  const saveSuggestion = async () => {
    if (!user || !suggestion.trim()) {
      toast.error('Please enter your suggestion');
      return;
    }
    setSavingParent(true);
    try {
      const { error } = await supabase.from('suggestion_box').insert({
        submitted_by: user.id,
        suggestion_text: suggestion,
        category: 'general',
      });
      if (error) throw error;
      toast.success('Suggestion submitted! Thank you. 💡');
      setSuggestion('');
    } catch (err: any) {
      toast.error('Failed to submit: ' + err.message);
    } finally {
      setSavingParent(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: 'var(--primary)' }} />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ color: 'var(--primary)' }} />
          </svg>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    const handleLinkInviteCode = async () => {
      if (!inviteCodeInput.trim()) return;
      setLinkingCode(true);
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('link_student_to_mentor_by_code', {
          p_mentor_code: inviteCodeInput.trim().toUpperCase(),
        });
        if (rpcError || !rpcData?.success) {
          toast.error(rpcData?.error || rpcError?.message || 'Invalid invite code. Please check and try again.');
        } else {
          toast.success('Successfully linked to your mentor! Loading your dashboard... 🎉');
          setInviteCodeInput('');
          await loadData();
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to link invite code');
      } finally {
        setLinkingCode(false);
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center">
          <AlertCircle size={28} className="text-white" />
        </div>
        <div className="text-center max-w-sm">
          <p className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>No student profile linked</p>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Enter the 8-character invite code your mentor gave you to link your account.
          </p>
        </div>

        {/* Invite code entry */}
        <div
          className="w-full max-w-sm rounded-2xl p-5 card-glow"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <p className="text-sm font-600 mb-3 text-center" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
            🔑 Enter Mentor Invite Code
          </p>
          <input
            type="text"
            className="input-mystic uppercase tracking-widest text-center text-xl font-bold mb-3"
            placeholder="AB12CD34"
            maxLength={8}
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleLinkInviteCode()}
            style={{ letterSpacing: '0.3em' }}
          />
          <button
            onClick={handleLinkInviteCode}
            disabled={linkingCode || inviteCodeInput.trim().length < 8}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {linkingCode ? (
              <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : null}
            {linkingCode ? 'Linking...' : 'Link My Account'}
          </button>
          <p className="text-xs text-center mt-3" style={{ color: 'var(--muted-foreground)' }}>
            Ask your mentor for the 8-character code from their dashboard.
          </p>
        </div>

        {/* School Code Linking */}
        <div
          className="w-full max-w-sm rounded-2xl p-5 text-center"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            🏫 Link to Your School (Optional)
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Enter the school invite code (S-XXXXXX) to connect your account to your institution.
          </p>
          <input
            type="text"
            className="input-mystic uppercase tracking-widest text-center text-lg font-bold mb-3"
            placeholder="S-AB12CD"
            maxLength={8}
            value={schoolCodeInput}
            onChange={(e) => setSchoolCodeInput(e.target.value.toUpperCase())}
            style={{ letterSpacing: '0.3em' }}
          />
          {schoolLinked ? (
            <p className="text-sm font-bold" style={{ color: '#1565C0' }}>✓ Linked to school!</p>
          ) : (
            <button
              onClick={async () => {
                if (schoolCodeInput.trim().length < 8) return;
                setLinkingSchoolCode(true);
                try {
                  const { data: rpcData, error: rpcError } = await supabase.rpc('use_school_invite_code', {
                    p_invite_code: schoolCodeInput.trim().toUpperCase(),
                  });
                  if (rpcError || !(rpcData as any)?.success) {
                    toast.error((rpcData as any)?.error || rpcError?.message || 'Invalid school code.');
                  } else {
                    toast.success('Linked to your school! 🏫');
                    setSchoolLinked(true);
                  }
                } catch (err: any) {
                  toast.error(err?.message || 'Failed to link school code');
                } finally {
                  setLinkingSchoolCode(false);
                }
              }}
              disabled={linkingSchoolCode || schoolCodeInput.trim().length < 8}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              {linkingSchoolCode ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : null}
              {linkingSchoolCode ? 'Linking...' : 'Link to School'}
            </button>
          )}
        </div>

        <button
          onClick={() => loadData()}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
          Retry / Refresh
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Star },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'report', label: 'Report Card', icon: BookOpen },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'tasks', label: 'My Tasks', icon: Target },
    { id: 'surveys', label: 'Surveys', icon: ClipboardList },
    { id: 'parent', label: 'Parent Zone', icon: Heart },
  ] as const;

  return (
    <div className="fade-in">
      {/* Tier Banner */}
      <div
        className="rounded-2xl p-5 mb-6 relative overflow-hidden"
        style={{ background: tier.bg, border: `2px solid ${tier.border}` }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{tier.emoji}</span>
              <span className="text-lg font-bold" style={{ color: tier.color }}>
                The Quest — {tier.name}
              </span>
            </div>
            <p className="text-sm" style={{ color: tier.color, opacity: 0.85 }}>{tier.banner}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <EmergencyContactWidget />
              <div className="flex items-center gap-1.5">
                <Trophy size={16} style={{ color: tier.color }} />
                <span className="font-bold text-sm" style={{ color: tier.color }}>
                  Avg Score: {student.avg_score}%
                </span>
              </div>
            </div>
            <span className="text-xs" style={{ color: tier.color, opacity: 0.7 }}>
              {student.sessions} sessions completed
            </span>
          </div>
        </div>
        {/* Tier progress dots */}
        <div className="flex items-center gap-2 mt-3">
          {TIERS.map((t, i) => (
            <div key={t.name} className="flex items-center gap-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                style={{
                  background: tier.name === t.name ? tier.color : 'rgba(0,0,0,0.1)',
                  color: tier.name === t.name ? 'white' : tier.color,
                  fontWeight: 700,
                }}
              >
                {t.emoji}
              </div>
              {i < TIERS.length - 1 && (
                <div className="w-8 h-0.5 rounded" style={{ background: 'rgba(0,0,0,0.15)' }} />
              )}
            </div>
          ))}
          <span className="text-xs ml-1" style={{ color: tier.color, opacity: 0.7 }}>
            {tier.name === 'Trailblazers' ? 'Top Tier! 🎉' : 'Keep going!'}
          </span>
        </div>
      </div>

      {/* Student info */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
          style={{ background: 'var(--gradient-primary)' }}
        >
          {student.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{student.name}</h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Grade {student.grade} · {student.primary_topic}
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto"
        style={{ background: 'var(--secondary)' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-600 transition-all whitespace-nowrap flex-shrink-0"
              style={{
                background: isActive ? 'var(--card)' : 'transparent',
                color: isActive ? 'var(--primary-dark)' : 'var(--muted-foreground)',
                fontWeight: 600,
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stats */}
          {[
            { label: 'Average Score', value: `${student.avg_score}%`, icon: TrendingUp, color: '#7C6EAA' },
            { label: 'Sessions Done', value: student.sessions, icon: Star, color: '#1565C0' },
            { label: 'Current Tier', value: `${tier.emoji} ${tier.name}`, icon: Trophy, color: tier.color },
            { label: 'Focus Pillar', value: student.primary_topic || 'General', icon: Target, color: '#2E7D32' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-2xl p-4 card-glow"
                style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--secondary)' }}>
                    <Icon size={18} style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</p>
                    <p className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>{stat.value}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Latest mentor feedback preview */}
          {latestSession && (
            <div
              className="md:col-span-2 rounded-2xl p-4 card-glow"
              style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={16} style={{ color: 'var(--primary)' }} />
                <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
                  Latest Mentor Insight — {latestSession.topic}
                </h3>
              </div>
              {latestSession.strengths?.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-600 mb-1" style={{ color: '#2E7D32', fontWeight: 600 }}>✅ Strengths</p>
                  <ul className="flex flex-col gap-1">
                    {(latestSession.strengths as any[]).slice(0, 2).map((s: any, i: number) => (
                      <li key={i} className="text-xs" style={{ color: 'var(--foreground)' }}>• {typeof s === 'string' ? s : s.text || JSON.stringify(s)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {latestSession.tasks?.length > 0 && (
                <div>
                  <p className="text-xs font-600 mb-1" style={{ color: '#1565C0', fontWeight: 600 }}>📋 Tasks for you</p>
                  <ul className="flex flex-col gap-1">
                    {(latestSession.tasks as any[]).slice(0, 2).map((t: any, i: number) => (
                      <li key={i} className="text-xs" style={{ color: 'var(--foreground)' }}>• {typeof t === 'string' ? t : t.text || JSON.stringify(t)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Calendar Tab ── */}
      {activeTab === 'calendar' && (
        <div
          className="rounded-2xl p-5 card-glow"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} style={{ color: 'var(--primary)' }} />
            <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
              Attendance & Meetings Calendar
            </h2>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
            View-only: Attendance is marked by your mentor. Click meeting links to join sessions.
          </p>
          {renderCalendar()}
        </div>
      )}

      {/* ── Report Card Tab ── */}
      {activeTab === 'report' && (
        <div className="flex flex-col gap-4">
          {/* Mentor's Insight (read-only) */}
          <div
            className="rounded-2xl p-5 card-glow"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Eye size={16} style={{ color: 'var(--primary)' }} />
              <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
                Mentor's Insight (Latest Session)
              </h2>
            </div>
            {latestSession ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--primary-dark)', fontWeight: 600 }}>
                    {latestSession.topic}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Score: {latestSession.score}%</span>
                </div>
                {[
                  { label: '✅ Strengths', items: latestSession.strengths, color: '#2E7D32', bg: '#E8F5E9' },
                  { label: '⚠️ Areas to Improve', items: latestSession.weaknesses, color: '#C62828', bg: '#FDECEA' },
                  { label: '🎯 Approach Required', items: latestSession.approach, color: '#E65100', bg: '#FFF3E0' },
                  { label: '📋 Task List', items: latestSession.tasks, color: '#1565C0', bg: '#E3F2FD' },
                ].map((section) => (
                  section.items && (section.items as any[]).length > 0 ? (
                    <div key={section.label} className="p-3 rounded-xl" style={{ background: section.bg }}>
                      <p className="text-xs font-600 mb-1.5" style={{ color: section.color, fontWeight: 600 }}>{section.label}</p>
                      <ul className="flex flex-col gap-1">
                        {(section.items as any[]).map((item: any, i: number) => (
                          <li key={i} className="text-xs" style={{ color: section.color }}>
                            • {typeof item === 'string' ? item : item.text || JSON.stringify(item)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No session analysis available yet.</p>
            )}
          </div>

          {/* Student Reflective Insights */}
          <div
            className="rounded-2xl p-5 card-glow"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={16} style={{ color: 'var(--primary)' }} />
              <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
                My Reflective Insights
              </h2>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Your reflections are automatically shared with your mentor.
            </p>
            <div className="flex flex-col gap-4">
              {[
                { key: 'learned', label: '💡 What did I learn this week?', placeholder: 'Share what you discovered or understood this week...' },
                { key: 'needs_work', label: '🔧 Which aspects do I need to work on further?', placeholder: 'Be honest about areas where you want to improve...' },
                { key: 'team_dynamics', label: '🤝 How was my team dynamics, and what was the best thing about my team?', placeholder: 'Reflect on collaboration, communication, and team highlights...' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                    {field.label}
                  </label>
                  <textarea
                    className="input-mystic resize-none"
                    rows={3}
                    placeholder={field.placeholder}
                    value={reflection[field.key as keyof typeof reflection]}
                    onChange={(e) => setReflection((r) => ({ ...r, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
              <button
                onClick={saveReflection}
                disabled={savingReflection}
                className="btn-primary flex items-center gap-2 self-end"
              >
                {savingReflection ? (
                  <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <Send size={14} />}
                Save Reflection
              </button>
            </div>
          </div>

          {/* Mentor's Response to Reflection */}
          {latestReflection?.mentor_response && (
            <div
              className="rounded-2xl p-5 card-glow"
              style={{ background: '#F0FDF4', border: '1.5px solid #6EE7B7' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={16} style={{ color: '#065F46' }} />
                <h2 className="font-bold text-sm" style={{ color: '#065F46' }}>
                  Mentor's Response to Your Reflection
                </h2>
                {latestReflection.responded_at && (
                  <span className="text-xs ml-auto" style={{ color: '#065F46', opacity: 0.7 }}>
                    {new Date(latestReflection.responded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: '#065F46' }}>
                {latestReflection.mentor_response}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Feedback Tab ── */}
      {activeTab === 'feedback' && (
        <div
          className="rounded-2xl p-5 card-glow"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={16} style={{ color: 'var(--primary)' }} />
            <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
              Rate Your Mentor & Sessions
            </h2>
          </div>
          <div className="flex flex-col gap-5">
            {/* Rating sliders */}
            {[
              { key: 'mentor_interaction', label: '🌟 Mentor Interaction' },
              { key: 'active_listening', label: '👂 Active Listening' },
              { key: 'teaching_clarity', label: '📖 Teaching Clarity' },
            ].map((item) => (
              <div key={item.key}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-600" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                    {item.label}
                  </label>
                  <span
                    className="text-sm font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--secondary)', color: 'var(--primary-dark)' }}
                  >
                    {feedback[item.key as keyof typeof feedback]}/10
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={feedback[item.key as keyof typeof feedback] as number}
                  onChange={(e) => setFeedback((f) => ({ ...f, [item.key]: Number(e.target.value) }))}
                  className="w-full accent-primary"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  <span>Needs Improvement</span>
                  <span>Excellent</span>
                </div>
              </div>
            ))}

            {/* Open-ended */}
            <div>
              <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                ✨ What was most fruitful about the sessions?
              </label>
              <textarea
                className="input-mystic resize-none"
                rows={3}
                placeholder="Share what helped you the most..."
                value={feedback.fruitful_comments}
                onChange={(e) => setFeedback((f) => ({ ...f, fruitful_comments: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                🙋 Where do you need more help or support?
              </label>
              <textarea
                className="input-mystic resize-none"
                rows={3}
                placeholder="Be specific about areas where you need more guidance..."
                value={feedback.help_needed}
                onChange={(e) => setFeedback((f) => ({ ...f, help_needed: e.target.value }))}
              />
            </div>

            <button
              onClick={saveFeedback}
              disabled={savingFeedback}
              className="btn-primary flex items-center gap-2 self-end"
            >
              {savingFeedback ? (
                <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : <Send size={14} />}
              Submit Feedback
            </button>
          </div>
        </div>
      )}

      {/* ── Parent Zone Tab ── */}
      {activeTab === 'parent' && (
        <div className="flex flex-col gap-4">
          {/* Parent Observation */}
          <div
            className="rounded-2xl p-5 card-glow"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Heart size={16} style={{ color: '#C62828' }} />
              <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
                Parent Observation Form
              </h2>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                  📝 Notes on your child's progress
                </label>
                <textarea
                  className="input-mystic resize-none"
                  rows={4}
                  placeholder="Share observations about your child's learning, behavior, or progress at home..."
                  value={parentObs.observation}
                  onChange={(e) => setParentObs((p) => ({ ...p, observation: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                  🌟 Program experience feedback
                </label>
                <textarea
                  className="input-mystic resize-none"
                  rows={3}
                  placeholder="How has the program impacted your child? What do you appreciate most?"
                  value={parentObs.program_experience}
                  onChange={(e) => setParentObs((p) => ({ ...p, program_experience: e.target.value }))}
                />
              </div>
              <button
                onClick={saveParentObservation}
                disabled={savingParent}
                className="btn-primary flex items-center gap-2 self-end"
              >
                {savingParent ? (
                  <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <Send size={14} />}
                Submit Observation
              </button>
            </div>
          </div>

          {/* Suggestion Box */}
          <div
            className="rounded-2xl p-5 card-glow"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb size={16} style={{ color: '#E65100' }} />
              <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
                Suggestion Box
              </h2>
            </div>
            <textarea
              className="input-mystic resize-none mb-3"
              rows={4}
              placeholder="Share your ideas for improving the program, features you'd like to see, or any other suggestions..."
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
            />
            <button
              onClick={saveSuggestion}
              disabled={savingParent}
              className="btn-primary flex items-center gap-2"
            >
              {savingParent ? (
                <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : <Lightbulb size={14} />}
              Submit Suggestion
            </button>
          </div>

          {/* Parent Leaderboard */}
          <div
            className="rounded-2xl p-5 card-glow"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Award size={16} style={{ color: '#E65100' }} />
              <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
                Parent Engagement Leaderboard 🏆
              </h2>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Rankings based on platform activity, observations submitted, and overall engagement.
            </p>
            {leaderboard.length === 0 ? (
              <div className="flex flex-col items-center py-6 gap-2">
                <Award size={28} style={{ color: 'var(--muted-foreground)' }} />
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  No leaderboard data yet. Be the first to engage!
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {leaderboard.map((entry: any, i: number) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  const medal = medals[i] || `#${i + 1}`;
                  const parentName = entry.user_profiles?.full_name || 'Parent';
                  const studentName = entry.students?.name || 'Student';
                  return (
                    <div
                      key={entry.user_id}
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{
                        background: i === 0 ? '#FFF8E1' : 'var(--secondary)',
                        border: i === 0 ? '1.5px solid #FAE8A0' : '1px solid var(--border)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{medal}</span>
                        <div>
                          <p className="text-xs font-600" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                            {parentName}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            Student: {studentName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm" style={{ color: 'var(--primary-dark)' }}>
                          {entry.total_score} pts
                        </p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {entry.observations_count} obs · {entry.suggestions_count} sug
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── My Tasks Tab ── */}
      {activeTab === 'tasks' && <MyTasks />}

      {/* ── Surveys Tab ── */}
      {activeTab === 'surveys' && (
        <SurveysSection />
      )}
    </div>
  );
}
