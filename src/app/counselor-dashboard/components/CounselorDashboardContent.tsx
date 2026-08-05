'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Users, Plus, Copy, CheckCheck, RefreshCw, UserCheck, ChevronRight, BarChart2, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';


interface MentorProfile {
  id: string;
  full_name: string;
  email: string;
  mentor_code: string | null;
  student_count: number;
  session_count: number;
}

interface StudentSearchResult {
  id: string;
  name: string;
  student_email: string | null;
  grade: string;
  avg_score: number;
  sessions: number;
  mentor_id: string;
  mentor_name: string;
}

export default function CounselorDashboardContent() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<{ invite_code: string; created_at: string }[]>([]);
  // mentors tab only

  const fetchMentors = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch mentors linked to this counselor
      const { data: mentorProfiles, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, mentor_code')
        .eq('counselor_id', user.id)
        .eq('role', 'mentor');

      if (error) throw error;

      // For each mentor, count students and sessions
      const enriched: MentorProfile[] = await Promise.all(
        (mentorProfiles || []).map(async (m) => {
          const { count: studentCount } = await supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .eq('mentor_id', m.id);

          const { count: sessionCount } = await supabase
            .from('sessions')
            .select('id', { count: 'exact', head: true })
            .eq('mentor_id', m.id);

          return {
            id: m.id,
            full_name: m.full_name,
            email: m.email,
            mentor_code: m.mentor_code,
            student_count: studentCount ?? 0,
            session_count: sessionCount ?? 0,
          };
        })
      );

      setMentors(enriched);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load mentors');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchPendingInvites = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('counselor_mentor_invites')
        .select('invite_code, created_at')
        .eq('counselor_id', user.id)
        .is('used_by', null)
        .order('created_at', { ascending: false })
        .limit(5);
      setPendingInvites(data || []);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    fetchMentors();
    fetchPendingInvites();
  }, [fetchMentors, fetchPendingInvites]);

  const handleGenerateInvite = async () => {
    setGeneratingCode(true);
    try {
      const { data, error } = await supabase.rpc('counselor_generate_mentor_invite');
      if (error) throw error;
      const result = data as { success: boolean; invite_code?: string; error?: string };
      if (!result.success) throw new Error(result.error || 'Failed to generate code');
      setInviteCode(result.invite_code || null);
      fetchPendingInvites();
      toast.success('Invite code generated!');
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

  const handleStudentSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      // Search students by name or email across all mentors linked to this counselor
      const { data: mentorIds } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('counselor_id', user!.id)
        .eq('role', 'mentor');

      const ids = (mentorIds || []).map((m) => m.id);
      if (ids.length === 0) {
        setSearchResults([]);
        return;
      }

      const { data: students, error } = await supabase
        .from('students')
        .select('id, name, student_email, grade, avg_score, sessions, mentor_id')
        .in('mentor_id', ids)
        .or(`name.ilike.%${searchQuery}%,student_email.ilike.%${searchQuery}%`);

      if (error) throw error;

      // Enrich with mentor names
      const enriched: StudentSearchResult[] = await Promise.all(
        (students || []).map(async (s) => {
          const { data: mentorProfile } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', s.mentor_id)
            .single();
          return {
            ...s,
            mentor_name: mentorProfile?.full_name || 'Unknown Mentor',
          };
        })
      );

      setSearchResults(enriched);
    } catch (err: any) {
      toast.error(err?.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const initials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
            Counselor Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {loading ? 'Loading...' : `Supervising ${mentors.length} mentor${mentors.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowInvitePanel((v) => !v)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={16} />
          Add New Mentor
        </button>
      </div>

      {/* Invite Panel */}
      {showInvitePanel && (
        <div
          className="rounded-2xl p-5 mb-6 card-glow"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <UserCheck size={16} style={{ color: 'var(--primary)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
              Generate Mentor Invite Code
            </h3>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Generate a unique code and share it with a Mentor. They enter it during Sign Up to link to your supervision.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <button
              onClick={handleGenerateInvite}
              disabled={generatingCode}
              className="btn-primary flex items-center gap-2"
            >
              {generatingCode ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {generatingCode ? 'Generating...' : 'Generate New Code'}
            </button>
          </div>

          {inviteCode && (
            <div
              className="flex items-center gap-3 p-3 rounded-xl mb-4"
              style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
            >
              <span
                className="font-mono text-lg font-bold tracking-widest flex-1"
                style={{ color: 'var(--primary-dark)' }}
              >
                {inviteCode}
              </span>
              <button
                onClick={() => handleCopyCode(inviteCode)}
                className="btn-secondary flex items-center gap-1 text-xs"
              >
                {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}

          {pendingInvites.length > 0 && (
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
                Pending (unused) codes:
              </p>
              <div className="flex flex-wrap gap-2">
                {pendingInvites.map((inv) => (
                  <div
                    key={inv.invite_code}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
                  >
                    <span className="font-mono text-xs font-bold" style={{ color: 'var(--foreground)' }}>
                      {inv.invite_code}
                    </span>
                    <button onClick={() => handleCopyCode(inv.invite_code)} className="opacity-60 hover:opacity-100">
                      <Copy size={11} style={{ color: 'var(--muted-foreground)' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Student Search */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Search size={16} style={{ color: 'var(--primary)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            Search Student
          </h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="input-mystic flex-1"
            placeholder="Search by student name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStudentSearch()}
          />
          <button
            onClick={handleStudentSearch}
            disabled={searching || !searchQuery.trim()}
            className="btn-primary flex items-center gap-2"
          >
            {searching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {searchResults.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/counselor-student-view?studentId=${s.id}`)}
                className="flex items-center gap-3 p-3 rounded-xl text-left hover:opacity-80 transition-opacity"
                style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--gradient-primary)', color: 'white' }}
                >
                  {initials(s.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                    {s.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {s.student_email || 'No email'} · Mentor: {s.mentor_name}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Avg: <strong style={{ color: 'var(--foreground)' }}>{s.avg_score}%</strong>
                  </span>
                  <Eye size={14} style={{ color: 'var(--primary)' }} />
                </div>
              </button>
            ))}
          </div>
        )}

        {searchQuery && searchResults.length === 0 && !searching && (
          <p className="text-xs mt-3" style={{ color: 'var(--muted-foreground)' }}>
            No students found matching &quot;{searchQuery}&quot;.
          </p>
        )}
      </div>

      {/* Mentor Directory */}
      <div className="mb-4">
          <h2 className="text-base font-bold mb-3" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            Your Mentors
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl p-5 animate-pulse"
                  style={{ background: 'var(--card)', height: '140px' }}
                />
              ))}
            </div>
          ) : mentors.length === 0 ? (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: 'var(--card)', border: '1.5px dashed var(--border)' }}
            >
              <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                No mentors linked yet
              </p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Generate an invite code above and share it with a Mentor during their sign-up.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mentors.map((mentor) => (
                <div
                  key={mentor.id}
                  className="rounded-2xl p-5 card-glow cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
                  onClick={() => router.push(`/counselor-mentor-analytics?mentorId=${mentor.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: 'var(--gradient-primary)', color: 'white' }}
                      >
                        {initials(mentor.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                          {mentor.full_name}
                        </p>
                        <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                          {mentor.email}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--muted-foreground)' }} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className="rounded-xl p-2.5 text-center"
                      style={{ background: 'var(--secondary)' }}
                    >
                      <p className="text-lg font-bold" style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>
                        {mentor.student_count}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Students</p>
                    </div>
                    <div
                      className="rounded-xl p-2.5 text-center"
                      style={{ background: 'var(--secondary)' }}
                    >
                      <p className="text-lg font-bold" style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>
                        {mentor.session_count}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Sessions</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5">
                    <BarChart2 size={12} style={{ color: 'var(--primary)' }} />
                    <span className="text-xs" style={{ color: 'var(--primary)' }}>
                      View Analytics
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}
