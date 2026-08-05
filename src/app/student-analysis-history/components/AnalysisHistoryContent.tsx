'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Calendar, Star, BarChart2, Trash2 } from 'lucide-react';
import AnalysisCards from './AnalysisCards';
import SessionHistoryTable from './SessionHistoryTable';
import ScoreBarChart from './ScoreBarChart';
import TopicPieChart from './TopicPieChart';
import JitsiVideoRoom from './JitsiVideoRoom';
import StudentCalendar from './StudentCalendar';
import DeleteStudentModal from '@/app/student-dashboard/components/DeleteStudentModal';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';

interface SessionData {
  id: string;
  date: string;
  topic: string;
  score: number | null;
  model: string;
  analysis: {
    strengths: string[];
    weaknesses: string[];
    approach: string[];
    tasks: string[];
  };
}

interface StudentInfo {
  id: string;
  name: string;
  avatar: string;
  sessions: number;
  avgScore: number;
  topics: string[];
  alertLevel: string | null;
  lastSession: string | null;
}

export default function AnalysisHistoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const studentId = searchParams.get('studentId') || '';
  const isNewSession = searchParams.get('newSession') === 'true';
  const highlightSessionId = searchParams.get('sessionId') || null;

  const [activeTab, setActiveTab] = useState<'analysis' | 'history' | 'charts' | 'video' | 'calendar'>('analysis');
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch student info and sessions from Supabase
  useEffect(() => {
    if (!user || !studentId) {
      setLoading(false);
      return;
    }

    const supabase = createClient();

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('id, name, avatar, sessions, avg_score, topics, alert_level, last_session')
          .eq('id', studentId)
          .eq('mentor_id', user!.id)
          .maybeSingle();

        if (studentError) {
          setError('Could not load student information.');
          setLoading(false);
          return;
        }

        if (studentData) {
          setStudent({
            id: studentData.id,
            name: studentData.name,
            avatar:
              studentData.avatar ||
              studentData.name
                ?.split(' ')
                .map((w: string) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase(),
            sessions: studentData.sessions ?? 0,
            avgScore: studentData.avg_score ?? 0,
            topics: studentData.topics ?? [],
            alertLevel: studentData.alert_level ?? null,
            lastSession: studentData.last_session ?? null,
          });
        }

        const { data: sessionRows, error: sessionsError } = await supabase
          .from('sessions')
          .select('id, session_date, topic, score, model, strengths, weaknesses, approach, tasks')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false });

        if (sessionsError) {
          setError('Could not load session history.');
          setLoading(false);
          return;
        }

        const mapped: SessionData[] = (sessionRows ?? []).map((row) => ({
          id: row.id,
          date: row.session_date,
          topic: row.topic,
          score: row.score ?? null,
          model: row.model,
          analysis: {
            strengths: Array.isArray(row.strengths) ? row.strengths : [],
            weaknesses: Array.isArray(row.weaknesses) ? row.weaknesses : [],
            approach: Array.isArray(row.approach) ? row.approach : [],
            tasks: Array.isArray(row.tasks) ? row.tasks : [],
          },
        }));

        setSessions(mapped);
      } catch (err: any) {
        setError('An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user, studentId]);

  // ── Real-time: auto-refresh sessions and attendance when data changes ──
  const refreshSessions = useCallback(() => {
    if (!user || !studentId) return;
    const supabase = createClient();
    supabase
      .from('sessions')
      .select('id, session_date, topic, score, model, strengths, weaknesses, approach, tasks')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .then(({ data: sessionRows }) => {
        if (!sessionRows) return;
        const mapped: SessionData[] = sessionRows.map((row) => ({
          id: row.id,
          date: row.session_date,
          topic: row.topic,
          score: row.score ?? null,
          model: row.model,
          analysis: {
            strengths: Array.isArray(row.strengths) ? row.strengths : [],
            weaknesses: Array.isArray(row.weaknesses) ? row.weaknesses : [],
            approach: Array.isArray(row.approach) ? row.approach : [],
            tasks: Array.isArray(row.tasks) ? row.tasks : [],
          },
        }));
        setSessions(mapped);
      });
  }, [user, studentId]);

  useRealtimeSubscription(
    user && studentId
      ? [
          { table: 'sessions',   filter: `student_id=eq.${studentId}`, onRefresh: refreshSessions },
          { table: 'attendance', filter: `student_id=eq.${studentId}`, onRefresh: refreshSessions },
        ]
      : []
  );

  const latestSession = sessions[0] ?? null;

  const highlightedSession = highlightSessionId
    ? sessions.find((s) => s.id === highlightSessionId) ?? latestSession
    : latestSession;

  const displayedAnalysisSession = highlightedSession ?? latestSession;

  const scoreColor = (score: number) => {
    if (score >= 80) return '#2E7D32';
    if (score >= 60) return '#F57F17';
    return '#C62828';
  };

  const tabs = [
    { id: 'analysis' as const, label: 'Analysis', count: null },
    { id: 'charts' as const, label: 'Charts', count: null },
    { id: 'history' as const, label: 'History', count: sessions.length },
    { id: 'video' as const, label: 'Live Video', count: null },
    { id: 'calendar' as const, label: 'Calendar', count: null },
  ];

  if (loading) {
    return (
      <div className="fade-in flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading student data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in">
        <button
          onClick={() => router.push('/student-dashboard')}
          className="flex items-center gap-1.5 text-sm mb-5 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft size={15} />
          Back to Dashboard
        </button>
        <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
          <p className="text-sm" style={{ color: '#C62828' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="fade-in">
        <button
          onClick={() => router.push('/student-dashboard')}
          className="flex items-center gap-1.5 text-sm mb-5 hover:opacity-70 transition-opacity"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft size={15} />
          Back to Dashboard
        </button>
        <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Student not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Back nav */}
      <button
        onClick={() => router.push('/student-dashboard')}
        className="flex items-center gap-1.5 text-sm mb-5 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft size={15} />
        Back to Dashboard
      </button>

      {/* Student header */}
      <div
        className="rounded-2xl p-6 mb-6 card-glow"
        style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
            style={{ background: 'var(--gradient-primary)', color: 'white' }}
          >
            {student.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                {student.name}
              </h1>
              {student.alertLevel && (
                <span
                  className="text-xs font-600 px-2 py-0.5 rounded-full"
                  style={{
                    background: student.alertLevel === 'alert' ? '#FDECEA' : '#FFF8E1',
                    color: student.alertLevel === 'alert' ? '#C62828' : '#F57F17',
                    fontWeight: 600,
                  }}
                >
                  {student.alertLevel === 'alert' ? '⚠ Needs Attention' : '⚡ Declining'}
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {student.id} · {student.sessions} sessions · {student.topics.length} topics covered
            </p>
            <div className="flex flex-wrap gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <Star size={14} style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-600" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                  Avg Score:{' '}
                  <span style={{ color: scoreColor(student.avgScore), fontVariantNumeric: 'tabular-nums' }}>
                    {student.avgScore}%
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={14} style={{ color: 'var(--muted-foreground)' }} />
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Last session: {student.lastSession ?? 'No sessions yet'}
                </span>
              </div>
              {latestSession && (
                <div className="flex items-center gap-1.5">
                  <BarChart2 size={14} style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Latest topic: {latestSession.topic}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 self-start sm:self-center">
            <button
              onClick={() => router.push(`/new-session`)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={15} />
              New Session
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 transition-all duration-150"
              style={{
                background: '#FDECEA',
                color: '#C62828',
                fontWeight: 600,
                border: '1.5px solid #FFCDD2',
              }}
            >
              <Trash2 size={15} />
              Delete Student
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl overflow-x-auto" style={{ background: 'var(--secondary)' }}>
        {tabs.map((tab) => (
          <button
            key={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-600 flex-shrink-0 justify-center transition-all duration-150"
            style={{
              fontWeight: 600,
              background: activeTab === tab.id ? 'var(--card)' : 'transparent',
              color: activeTab === tab.id ? 'var(--primary-dark)' : 'var(--muted-foreground)',
              boxShadow: activeTab === tab.id ? '0 1px 4px rgba(124,110,170,0.10)' : 'none',
            }}
          >
            {tab.label}
            {tab.count !== null && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: activeTab === tab.id ? 'var(--secondary)' : 'var(--muted)',
                  color: 'var(--muted-foreground)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'analysis' && (
        <div className="fade-in">
          {displayedAnalysisSession ? (
            <>
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5"
                style={{ background: 'var(--secondary)', border: '1.5px solid var(--border)' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  <Star size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-600" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                    Session: {displayedAnalysisSession.date} · Topic: {displayedAnalysisSession.topic}
                    {displayedAnalysisSession.score !== null && ` · Score: ${displayedAnalysisSession.score}/100`}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Generated by {displayedAnalysisSession.model} · AI Persona: Veteran Educator (60+ years)
                  </p>
                </div>
                {isNewSession && highlightSessionId && (
                  <span
                    className="text-xs font-600 px-2 py-1 rounded-full flex-shrink-0"
                    style={{ background: '#E8F5E9', color: '#2E7D32', fontWeight: 600 }}
                  >
                    ✓ Just generated
                  </span>
                )}
              </div>
              <AnalysisCards analysis={displayedAnalysisSession.analysis} />
            </>
          ) : (
            <div
              className="rounded-2xl p-10 text-center"
              style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                No sessions yet. Start a new session to generate an AI analysis.
              </p>
              <button
                onClick={() => router.push('/new-session')}
                className="btn-primary mt-4 inline-flex items-center gap-2"
              >
                <Plus size={15} />
                Start First Session
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'charts' && (
        <div className="fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScoreBarChart sessions={sessions} studentName={student.name} />
            <TopicPieChart sessions={sessions} studentName={student.name} />
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="fade-in">
          <SessionHistoryTable
            sessions={sessions}
            studentName={student.name}
            onViewSession={() => setActiveTab('analysis')}
          />
        </div>
      )}

      {activeTab === 'video' && (
        <div className="fade-in">
          <JitsiVideoRoom studentName={student.name} />
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="fade-in">
          <StudentCalendar studentId={student.id} studentName={student.name} />
        </div>
      )}

      {/* Delete Student Modal */}
      {showDeleteModal && (
        <DeleteStudentModal
          studentId={student.id}
          studentName={student.name}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => router.push('/student-dashboard')}
        />
      )}
    </div>
  );
}