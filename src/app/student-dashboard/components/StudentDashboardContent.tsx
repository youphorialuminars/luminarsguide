'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Users, Filter, Link2, Copy, CheckCheck, RefreshCw, Mail, UserCheck, ShieldCheck, CheckSquare, ClipboardList, Trophy, Building2, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import StudentCard from './StudentCard';
import AddStudentModal from './AddStudentModal';
import DeleteStudentModal from './DeleteStudentModal';
import DashboardStats from './DashboardStats';
import WeeklyReflectionForm from './WeeklyReflectionForm';
import ManageSurveys from './ManageSurveys';
import AssignTasks from './AssignTasks';
import MentorPeerRanking from './MentorPeerRanking';
import MentorChatList from './MentorChatList';
import EmergencyContactWidget from '@/components/EmergencyContactWidget';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';
import { toast } from 'sonner';

export interface Student {
  id: string;
  name: string;
  avatar: string;
  lastSession: string | null;
  avgScore: number;
  sessions: number;
  topics: string[];
  trend: string;
  alertLevel: string | null;
  studentCode: string;
  grade: string;
  primaryTopic: string;
}

const TOPIC_FILTERS = ['All Topics', 'Mathematics', 'Science', 'Language Arts', 'Leadership', 'Emotional Regulation', 'Digital Literacy', 'Civic Sense', 'Well-being'];

function mapRow(row: any): Student {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar || row.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
    lastSession: row.last_session ?? null,
    avgScore: row.avg_score ?? 0,
    sessions: row.sessions ?? 0,
    topics: row.topics ?? [],
    trend: row.trend ?? 'stable',
    alertLevel: row.alert_level ?? null,
    studentCode: row.student_code,
    grade: row.grade,
    primaryTopic: row.primary_topic,
  };
}

export default function StudentDashboardContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTopicFilter, setActiveTopicFilter] = useState('All Topics');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Active main tab
  const [activeMainTab, setActiveMainTab] = useState<'students' | 'surveys' | 'tasks' | 'ranking' | 'chat'>('students');

  // Mentor code state
  const [mentorCode, setMentorCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);

  // Link by email
  const [studentEmail, setStudentEmail] = useState('');
  const [linkingEmail, setLinkingEmail] = useState(false);

  // Counselor code linking
  const [counselorCode, setCounselorCode] = useState('');
  const [linkingCounselor, setLinkingCounselor] = useState(false);
  const [counselorLinked, setCounselorLinked] = useState(false);

  // School code linking
  const [schoolCode, setSchoolCode] = useState('');
  const [linkingSchool, setLinkingSchool] = useState(false);
  const [schoolLinked, setSchoolLinked] = useState(false);

  const fetchStudents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('mentor_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setStudents((data ?? []).map(mapRow));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchMentorCode = useCallback(async () => {
    if (!user) return;
    setLoadingCode(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('user_profiles')
        .select('mentor_code')
        .eq('id', user.id)
        .single();
      setMentorCode(data?.mentor_code || null);
    } catch {
      // ignore
    } finally {
      setLoadingCode(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStudents();
    fetchMentorCode();
  }, [fetchStudents, fetchMentorCode]);

  // ── Real-time: auto-refresh when sessions or students change ──
  useRealtimeSubscription(
    user
      ? [
          { table: 'sessions', onRefresh: fetchStudents },
          { table: 'attendance', onRefresh: fetchStudents },
        ]
      : []
  );

  const handleStudentAdded = () => {
    fetchStudents();
  };

  const handleDeleteStudent = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({ id, name });
  };

  const handleCopyCode = async () => {
    if (!mentorCode) return;
    try {
      await navigator.clipboard.writeText(mentorCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Mentor code copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleRegenerateCode = async () => {
    setRegenerating(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('regenerate_mentor_code');
      if (error) throw error;
      setMentorCode(data as string);
      toast.success('New mentor code generated!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to regenerate code');
    } finally {
      setRegenerating(false);
    }
  };

  const handleLinkByEmail = async () => {
    if (!studentEmail.trim()) {
      toast.error('Please enter a student email address');
      return;
    }
    setLinkingEmail(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('mentor_link_student_by_email', {
        p_student_email: studentEmail.trim().toLowerCase(),
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast.error(result.error || 'Failed to link student');
      } else {
        toast.success('Student linked successfully!');
        setStudentEmail('');
        fetchStudents();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to link student');
    } finally {
      setLinkingEmail(false);
    }
  };

  const handleLinkToCounselor = async () => {
    const code = counselorCode.trim().toUpperCase();
    if (!code) {
      toast.error('Please enter a counselor invite code');
      return;
    }
    if (code.length !== 8) {
      toast.error('Counselor code must be 8 characters (e.g. C-AB12CD)');
      return;
    }
    setLinkingCounselor(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('mentor_use_counselor_invite', {
        p_invite_code: code,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast.error(result.error || 'Invalid or already-used counselor code');
      } else {
        toast.success('Successfully linked to your counselor! 🎉');
        setCounselorCode('');
        setCounselorLinked(true);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to link to counselor');
    } finally {
      setLinkingCounselor(false);
    }
  };

  const handleLinkToSchool = async () => {
    const code = schoolCode.trim().toUpperCase();
    if (!code) {
      toast.error('Please enter a school invite code');
      return;
    }
    if (code.length !== 8) {
      toast.error('School code must be 8 characters (e.g. S-AB12CD)');
      return;
    }
    setLinkingSchool(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('use_school_invite_code', {
        p_invite_code: code,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast.error(result.error || 'Invalid school invite code');
      } else {
        toast.success('Successfully linked to your school! 🏫');
        setSchoolCode('');
        setSchoolLinked(true);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to link to school');
    } finally {
      setLinkingSchool(false);
    }
  };

  const filtered = students?.filter((s) => {
    const matchSearch =
      s?.name?.toLowerCase()?.includes(search?.toLowerCase()) ||
      s?.studentCode?.toLowerCase()?.includes(search?.toLowerCase());
    const matchTopic =
      activeTopicFilter === 'All Topics' || s?.topics?.includes(activeTopicFilter);
    return matchSearch && matchTopic;
  });

  return (
    <div className="fade-in">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            Student Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {loading ? 'Loading...' : `${students?.length} students registered`}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <EmergencyContactWidget />
          <button
            onClick={() => setShowCodePanel((v) => !v)}
            className="btn-secondary flex items-center gap-2"
            title="Mentor Code & Linking"
          >
            <Link2 size={15} />
            <span className="hidden sm:inline">Mentor Code</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Register New Student
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto"
        style={{ background: 'var(--secondary)', border: '1px solid var(--border)', width: 'fit-content' }}
      >
        {([
          { id: 'students', label: 'My Students', icon: Users },
          { id: 'tasks', label: 'Assign Tasks', icon: CheckSquare },
          { id: 'surveys', label: 'Manage Surveys', icon: ClipboardList },
          { id: 'ranking', label: 'Peer Ranking', icon: Trophy },
          { id: 'chat', label: 'Chat', icon: MessageSquare },
        ] as const).map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeMainTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMainTab(tab.id)}
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

      {/* Mentor Code Panel */}
      {showCodePanel && (
        <div
          className="rounded-2xl p-5 mb-5 card-glow"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Link2 size={16} style={{ color: 'var(--primary)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
              Your Mentor Code
            </h3>
            <p className="text-xs ml-1" style={{ color: 'var(--muted-foreground)' }}>
              — Share with students to let them self-link to your roster
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Code display */}
            <div className="flex items-center gap-2 flex-1">
              {loadingCode ? (
                <div className="h-12 flex-1 rounded-xl animate-pulse" style={{ background: 'var(--secondary)' }} />
              ) : (
                <div
                  className="flex-1 px-4 py-3 rounded-xl font-mono text-lg font-bold tracking-widest text-center"
                  style={{ background: 'var(--secondary)', color: 'var(--primary-dark)', border: '1.5px solid var(--border)', letterSpacing: '0.2em' }}
                >
                  {mentorCode || '—'}
                </div>
              )}
              <button
                onClick={handleCopyCode}
                disabled={!mentorCode}
                className="p-3 rounded-xl transition-colors flex-shrink-0"
                style={{ background: 'var(--secondary)', border: '1.5px solid var(--border)' }}
                title="Copy code"
              >
                {copied ? <CheckCheck size={16} style={{ color: '#2E7D32' }} /> : <Copy size={16} style={{ color: 'var(--primary)' }} />}
              </button>
              <button
                onClick={handleRegenerateCode}
                disabled={regenerating}
                className="p-3 rounded-xl transition-colors flex-shrink-0"
                style={{ background: 'var(--secondary)', border: '1.5px solid var(--border)' }}
                title="Regenerate code"
              >
                <RefreshCw size={16} style={{ color: 'var(--muted-foreground)', animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>

            {/* Link by email */}
            <div className="flex items-center gap-2 flex-1">
              <Mail size={15} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
              <input
                type="email"
                className="input-mystic flex-1"
                placeholder="Link student by email..."
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLinkByEmail()}
              />
              <button
                onClick={handleLinkByEmail}
                disabled={linkingEmail || !studentEmail.trim()}
                className="btn-primary flex items-center gap-1.5 px-3 flex-shrink-0"
              >
                {linkingEmail ? (
                  <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                ) : (
                  <><UserCheck size={14} />Link</>
                )}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4" style={{ borderTop: '1px solid var(--border)' }} />

          {/* Link to Counselor */}
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={15} style={{ color: 'var(--primary)' }} />
            <h4 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
              Link to Counselor
            </h4>
            <p className="text-xs ml-1" style={{ color: 'var(--muted-foreground)' }}>
              — Enter the 8-character code your counselor shared (e.g. C-AB12CD)
            </p>
          </div>

          {counselorLinked ? (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'var(--secondary)', color: '#2E7D32', border: '1.5px solid var(--border)' }}
            >
              <CheckCheck size={15} />
              Successfully linked to your counselor!
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="input-mystic flex-1 uppercase tracking-widest font-mono"
                placeholder="C-AB12CD"
                maxLength={8}
                value={counselorCode}
                onChange={(e) => setCounselorCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLinkToCounselor()}
              />
              <button
                onClick={handleLinkToCounselor}
                disabled={linkingCounselor || counselorCode.trim().length !== 8}
                className="btn-primary flex items-center gap-1.5 px-4 flex-shrink-0"
              >
                {linkingCounselor ? (
                  <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                ) : (
                  <ShieldCheck size={14} />
                )}
                {linkingCounselor ? 'Linking...' : 'Link'}
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="my-4" style={{ borderTop: '1px solid var(--border)' }} />

          {/* Link to School */}
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={15} style={{ color: 'var(--primary)' }} />
            <h4 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
              Link to School
            </h4>
            <p className="text-xs ml-1" style={{ color: 'var(--muted-foreground)' }}>
              — Enter the 8-character code your school shared (e.g. S-AB12CD)
            </p>
          </div>

          {schoolLinked ? (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'var(--secondary)', color: '#1565C0', border: '1.5px solid var(--border)' }}
            >
              <CheckCheck size={15} />
              Successfully linked to your school!
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="input-mystic flex-1 uppercase tracking-widest font-mono"
                placeholder="S-AB12CD"
                maxLength={8}
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLinkToSchool()}
              />
              <button
                onClick={handleLinkToSchool}
                disabled={linkingSchool || schoolCode.trim().length !== 8}
                className="btn-primary flex items-center gap-1.5 px-4 flex-shrink-0"
              >
                {linkingSchool ? (
                  <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                ) : (
                  <Building2 size={14} />
                )}
                {linkingSchool ? 'Linking...' : 'Link'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: '#FDECEA', color: '#C62828', border: '1px solid #FFCDD2' }}>
          {error}
        </div>
      )}

      {/* ── Students Tab ── */}
      {activeMainTab === 'students' && (
        <>
          {/* Stats row */}
          {!loading && students.length > 0 && <DashboardStats students={students} />}

          {/* Weekly Reflection Form */}
          <div className="mt-6 mb-6">
            <WeeklyReflectionForm />
          </div>

          {/* Search & filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5 mt-6">
            <div className="relative flex-1">
              <input
                type="text"
                className="input-mystic pl-9"
                placeholder="Search students by name or ID..."
                value={search}
                onChange={(e) => setSearch(e?.target?.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={15} style={{ color: 'var(--muted-foreground)' }} />
              <span className="text-xs font-500" style={{ color: 'var(--muted-foreground)', fontWeight: 500 }}>Filter:</span>
            </div>
          </div>

          {/* Topic filter chips */}
          <div className="flex gap-2 flex-wrap mb-6">
            {TOPIC_FILTERS?.map((topic) => (
              <button
                key={`chip-${topic}`}
                onClick={() => setActiveTopicFilter(topic)}
                className="px-3 py-1.5 rounded-full text-xs font-600 transition-all duration-150"
                style={{
                  fontWeight: 600,
                  background: activeTopicFilter === topic ? 'var(--primary)' : 'var(--secondary)',
                  color: activeTopicFilter === topic ? 'white' : 'var(--muted-foreground)',
                  border: '1.5px solid',
                  borderColor: activeTopicFilter === topic ? 'var(--primary)' : 'var(--border)',
                }}
              >
                {topic}
              </button>
            ))}
          </div>

          {/* Loading skeleton */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={`skel-${i}`} className="rounded-2xl p-5 animate-pulse" style={{ background: 'var(--card)', border: '1.5px solid var(--border)', height: 220 }} />
              ))}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--secondary)' }}>
                <Users size={28} style={{ color: 'var(--primary)' }} />
              </div>
              <h3 className="text-base font-600 mb-2" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                {students.length === 0 ? 'No students yet' : 'No students found'}
              </h3>
              <p className="text-sm text-center max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
                {students.length === 0
                  ? 'Register a student manually or share your Mentor Code so students can self-link.' : 'No students match your current search or filter. Try adjusting the filters or register a new student.'}
              </p>
              {students.length === 0 ? (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm flex items-center gap-2">
                    <Plus size={14} /> Register Student
                  </button>
                  <button onClick={() => setShowCodePanel(true)} className="btn-secondary text-sm flex items-center gap-2">
                    <Link2 size={14} /> Share Code
                  </button>
                </div>
              ) : (
                <button onClick={() => { setSearch(''); setActiveTopicFilter('All Topics'); }} className="btn-secondary mt-4 text-sm">
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
              {filtered?.map((student) => (
                <StudentCard
                  key={student?.id}
                  student={student}
                  onClick={() => router?.push(`/student-analysis-history?studentId=${student?.id}`)}
                  onDelete={(e) => handleDeleteStudent(student.id, student.name, e)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Assign Tasks Tab ── */}
      {activeMainTab === 'tasks' && <AssignTasks />}

      {/* ── Manage Surveys Tab ── */}
      {activeMainTab === 'surveys' && <ManageSurveys />}

      {/* ── Peer Ranking Tab ── */}
      {activeMainTab === 'ranking' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Trophy size={20} style={{ color: '#F59E0B' }} />
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                Self-Reflection &amp; Peer Ranking
              </h2>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Your performance score vs anonymous peer average — based on self-reflection, counselor feedback, student progress &amp; feedback
              </p>
            </div>
          </div>
          <MentorPeerRanking />
          <div className="mt-6">
            <WeeklyReflectionForm />
          </div>
        </div>
      )}

      {/* ── Chat Tab ── */}
      {activeMainTab === 'chat' && <MentorChatList />}

      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onStudentAdded={handleStudentAdded}
        />
      )}

      {deleteTarget && (
        <DeleteStudentModal
          studentId={deleteTarget.id}
          studentName={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); fetchStudents(); }}
        />
      )}
    </div>
  );
}
const MOCK_STUDENTS: any = null;

export { MOCK_STUDENTS };