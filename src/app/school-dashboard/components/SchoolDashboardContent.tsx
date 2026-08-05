'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, BookOpen, BarChart2, PieChart as PieChartIcon, Search,
  Copy, CheckCheck, RefreshCw, Plus, Building2, Eye, ChevronRight,
  TrendingUp, Award
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import EmergencyContactWidget from '@/components/EmergencyContactWidget';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LinkedProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  school_id: string | null;
}

interface StudentRow {
  id: string;
  name: string;
  student_email: string | null;
  grade: string;
  avg_score: number;
  sessions: number;
  mentor_id: string;
  mentor_name?: string;
}

interface MentorRow {
  id: string;
  full_name: string;
  email: string;
  student_count: number;
  session_count: number;
}

interface PillarData {
  name: string;
  value: number;
  color: string;
}

const PILLAR_COLORS = ['#7C6EAA', '#1565C0', '#E65100', '#2E7D32', '#C62828'];
const PILLARS = ['Mathematics', 'Science', 'Language Arts', 'Leadership', 'Well-being'];

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SchoolDashboardContent() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'mentors'>('overview');

  // Invite code state
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);

  // Data
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');
  const [mentorSearch, setMentorSearch] = useState('');

  // Analytics
  const [avgAttendance, setAvgAttendance] = useState(0);
  const [avgTaskCompletion, setAvgTaskCompletion] = useState(0);
  const [pillarData, setPillarData] = useState<PillarData[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch linked mentors
      const { data: mentorProfiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('school_id', user.id)
        .eq('role', 'mentor');

      const mentorList = mentorProfiles || [];
      const mentorIds = mentorList.map((m) => m.id);

      // Enrich mentors with student/session counts
      const enrichedMentors: MentorRow[] = await Promise.all(
        mentorList.map(async (m) => {
          const { count: sc } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('mentor_id', m.id);
          const { count: sess } = await supabase
            .from('sessions')
            .select('id', { count: 'exact', head: true })
            .eq('mentor_id', m.id);
          return { ...m, student_count: sc ?? 0, session_count: sess ?? 0 };
        })
      );
      setMentors(enrichedMentors);

      // Fetch linked students (via mentor_id in mentorIds)
      let allStudents: StudentRow[] = [];
      if (mentorIds.length > 0) {
        const { data: studentRows } = await supabase
          .from('students')
          .select('id, name, student_email, grade, avg_score, sessions, mentor_id, topics')
          .in('mentor_id', mentorIds);

        // Attach mentor names
        allStudents = (studentRows || []).map((s) => ({
          ...s,
          mentor_name: mentorList.find((m) => m.id === s.mentor_id)?.full_name || 'Unknown',
        }));
      }
      setStudents(allStudents);

      // ── Analytics ──
      // Avg attendance: fetch attendance records for all students
      if (allStudents.length > 0) {
        const studentIds = allStudents.map((s) => s.id);
        const { data: attRows } = await supabase
          .from('attendance')
          .select('status')
          .in('student_id', studentIds);

        const total = attRows?.length ?? 0;
        const present = attRows?.filter((r) => r.status === 'present').length ?? 0;
        setAvgAttendance(total > 0 ? Math.round((present / total) * 100) : 0);

        // Avg task completion
        const { data: taskRows } = await supabase
          .from('student_tasks')
          .select('status')
          .in('mentor_id', mentorIds);

        const totalTasks = taskRows?.length ?? 0;
        const completedTasks = taskRows?.filter((t) => t.status === 'Completed').length ?? 0;
        setAvgTaskCompletion(totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);

        // Pillar distribution from student topics
        const topicCounts: Record<string, number> = {};
        allStudents.forEach((s: any) => {
          (s.topics || []).forEach((t: string) => {
            topicCounts[t] = (topicCounts[t] || 0) + 1;
          });
        });
        const pillarArr: PillarData[] = PILLARS.map((p, i) => ({
          name: p,
          value: topicCounts[p] || 0,
          color: PILLAR_COLORS[i],
        })).filter((p) => p.value > 0);
        setPillarData(pillarArr.length > 0 ? pillarArr : PILLARS.map((p, i) => ({ name: p, value: 1, color: PILLAR_COLORS[i] })));
      } else {
        setAvgAttendance(0);
        setAvgTaskCompletion(0);
        setPillarData(PILLARS.map((p, i) => ({ name: p, value: 1, color: PILLAR_COLORS[i] })));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load school data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const { data, error } = await supabase.rpc('school_generate_invite_code');
      if (error) throw error;
      const result = data as { success: boolean; invite_code?: string; error?: string };
      if (!result.success) throw new Error(result.error || 'Failed to generate code');
      setInviteCode(result.invite_code || null);
      toast.success('School invite code generated!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate invite code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Code copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const barData = [
    { name: 'Attendance', value: avgAttendance, fill: '#7C6EAA' },
    { name: 'Task Completion', value: avgTaskCompletion, fill: '#1565C0' },
  ];

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.student_email || '').toLowerCase().includes(studentSearch.toLowerCase())
  );

  const filteredMentors = mentors.filter(
    (m) =>
      m.full_name.toLowerCase().includes(mentorSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(mentorSearch.toLowerCase())
  );

  return (
    <div className="fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            School Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {loading ? 'Loading...' : `${mentors.length} mentor${mentors.length !== 1 ? 's' : ''} · ${students.length} student${students.length !== 1 ? 's' : ''} linked`}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Emergency widget top-right */}
          <EmergencyContactWidget />
          <button
            onClick={() => setShowInvitePanel((v) => !v)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={15} />
            School Code
          </button>
        </div>
      </div>

      {/* ── Invite Panel ── */}
      {showInvitePanel && (
        <div
          className="rounded-2xl p-5 mb-6 card-glow"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={16} style={{ color: 'var(--primary)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
              Generate School Invite Code
            </h3>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Share this code (format: S-XXXXXX) with Students and Mentors. They enter it during sign-up or from their dashboard to link to your school.
          </p>
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleGenerateCode}
              disabled={generatingCode}
              className="btn-primary flex items-center gap-2"
            >
              {generatingCode ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {generatingCode ? 'Generating...' : 'Generate New Code'}
            </button>
          </div>
          {inviteCode && (
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
            >
              <span className="font-mono text-lg font-bold tracking-widest flex-1" style={{ color: 'var(--primary-dark)' }}>
                {inviteCode}
              </span>
              <button onClick={() => handleCopyCode(inviteCode)} className="btn-secondary flex items-center gap-1 text-xs">
                {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab Navigation ── */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto"
        style={{ background: 'var(--secondary)', border: '1px solid var(--border)', width: 'fit-content' }}
      >
        {([
          { id: 'overview', label: 'Institutional Overview', icon: BarChart2 },
          { id: 'students', label: 'Student Directory', icon: Users },
          { id: 'mentors', label: 'Mentor Directory', icon: BookOpen },
        ] as const).map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0"
              style={{
                background: isActive ? 'var(--card)' : 'transparent',
                color: isActive ? 'var(--primary-dark)' : 'var(--muted-foreground)',
                fontWeight: isActive ? 700 : 500,
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <TabIcon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div>
          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Active Students', value: students.length, icon: Users, color: '#7C6EAA' },
              { label: 'Active Mentors', value: mentors.length, icon: BookOpen, color: '#1565C0' },
              { label: 'Avg Attendance', value: `${avgAttendance}%`, icon: TrendingUp, color: '#2E7D32' },
              { label: 'Task Completion', value: `${avgTaskCompletion}%`, icon: Award, color: '#E65100' },
            ].map((m) => {
              const MIcon = m.icon;
              return (
                <div
                  key={m.label}
                  className="rounded-2xl p-4 card-glow"
                  style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: m.color + '22' }}>
                      <MIcon size={16} style={{ color: m.color }} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                    {loading ? '—' : m.value}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{m.label}</p>
                </div>
              );
            })}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <div
              className="rounded-2xl p-5"
              style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} style={{ color: 'var(--primary)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                  School-Wide Rates
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(v: any) => [`${v}%`, '']}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart */}
            <div
              className="rounded-2xl p-5"
              style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon size={16} style={{ color: 'var(--primary)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                  Educational Pillars Distribution
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pillarData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pillarData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', color: 'var(--muted-foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Student Directory Tab ── */}
      {activeTab === 'students' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
              <input
                type="text"
                className="input-mystic pl-9"
                placeholder="Search students by name or email..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: 'var(--card)', height: '72px' }} />
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--card)', border: '1.5px dashed var(--border)' }}>
              <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                {students.length === 0 ? 'No students linked yet' : 'No students found'}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {students.length === 0
                  ? 'Generate a school invite code and share it with students or mentors.' :'Try a different search term.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredStudents.map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/school-student-view?studentId=${s.id}`)}
                  className="flex items-center gap-3 p-4 rounded-2xl text-left hover:opacity-80 transition-opacity"
                  style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: 'var(--gradient-primary)', color: 'white' }}
                  >
                    {initials(s.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                      {s.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {s.student_email || 'No email'} · Mentor: {s.mentor_name} · Grade: {s.grade}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>{s.avg_score}%</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Avg Score</p>
                    </div>
                    <Eye size={14} style={{ color: 'var(--primary)' }} />
                    <ChevronRight size={14} style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Mentor Directory Tab ── */}
      {activeTab === 'mentors' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
              <input
                type="text"
                className="input-mystic pl-9"
                placeholder="Search mentors by name or email..."
                value={mentorSearch}
                onChange={(e) => setMentorSearch(e.target.value)}
              />
            </div>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {filteredMentors.length} mentor{filteredMentors.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl p-5 animate-pulse" style={{ background: 'var(--card)', height: '140px' }} />
              ))}
            </div>
          ) : filteredMentors.length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--card)', border: '1.5px dashed var(--border)' }}>
              <BookOpen size={32} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                {mentors.length === 0 ? 'No mentors linked yet' : 'No mentors found'}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {mentors.length === 0
                  ? 'Generate a school invite code and share it with mentors.' :'Try a different search term.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMentors.map((m) => (
                <button
                  key={m.id}
                  onClick={() => router.push(`/school-mentor-view?mentorId=${m.id}`)}
                  className="rounded-2xl p-5 card-glow text-left hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: 'var(--gradient-primary)', color: 'white' }}
                      >
                        {initials(m.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                          {m.full_name}
                        </p>
                        <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                          {m.email}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--secondary)' }}>
                      <p className="text-lg font-bold" style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>{m.student_count}</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Students</p>
                    </div>
                    <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--secondary)' }}>
                      <p className="text-lg font-bold" style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>{m.session_count}</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Sessions</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    <Eye size={12} style={{ color: 'var(--primary)' }} />
                    <span className="text-xs" style={{ color: 'var(--primary)' }}>View Analytics</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
