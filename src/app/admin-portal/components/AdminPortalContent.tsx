'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Shield, UserPlus, Users, Copy, Check, Eye, EyeOff, RefreshCw, Search, Link2, Edit3, Key, X, BookOpen, GraduationCap, UserCheck, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import { useRealtimeSubscription } from '@/lib/hooks/useRealtimeSubscription';


// ─── Types ────────────────────────────────────────────────────────────────────
interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  mentor_pillars?: string[];
  student_id?: string | null;
}

interface StudentRecord {
  id: string;
  name: string;
  student_code: string;
  grade: string;
  mentor_id: string | null;
  parent_name: string;
  parent_email: string;
  student_email: string;
  mentor_name?: string;
}

interface MentorRecord {
  id: string;
  full_name: string;
  email: string;
  mentor_pillars: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES = [
  { value: 'mentor', label: 'Mentor', color: '#7C6EAA', bg: '#E8E2FF' },
  { value: 'student_parent', label: 'Student / Parent', color: '#2E7D32', bg: '#E8F5E9' },
  { value: 'admin', label: 'Tech Admin', color: '#C62828', bg: '#FDECEA' },
];

const EDUCATIONAL_PILLARS = [
  'Teamwork and Leadership',
  'Digital Hygiene and Privacy Literacy',
  'Emotional Resilience and Mental Well-being',
  'Personal Safety, Consent, and Boundaries',
  'Civic Sense and Social Responsibility',
];

const TABS = [
  { id: 'directory', label: 'User Directory', icon: Users },
  { id: 'create-mentor', label: 'Create Mentor', icon: BookOpen },
  { id: 'create-student', label: 'Create Student & Parent', icon: GraduationCap },
  { id: 'assign', label: 'Assign Mentor', icon: Link2 },
] as const;

type TabId = typeof TABS[number]['id'];

function generatePassword(name: string): string {
  const base = name.replace(/\s+/g, '').slice(0, 6) || 'Luminar';
  const nums = Math.floor(1000 + Math.random() * 9000);
  const specials = ['@', '#', '!', '$'];
  const special = specials[Math.floor(Math.random() * specials.length)];
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}${nums}${special}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function CredentialsCard({
  credentials,
  onDismiss,
}: {
  credentials: { email: string; password: string; name: string };
  onDismiss: () => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success('Copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="rounded-2xl p-5 mb-6" style={{ background: '#E8F5E9', border: '2px solid #A5D6A7' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Check size={18} style={{ color: '#2E7D32' }} />
          <h3 className="font-bold text-sm" style={{ color: '#2E7D32' }}>
            Account created for {credentials.name}! Share these credentials:
          </h3>
        </div>
        <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-green-100">
          <X size={14} style={{ color: '#2E7D32' }} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: 'Email', value: credentials.email, key: 'email' },
          { label: 'Password', value: credentials.password, key: 'password' },
        ].map(({ label, value, key }) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'white', border: '1px solid #C8E6C9' }}>
            <div>
              <p className="text-xs font-600" style={{ color: '#2E7D32', fontWeight: 600 }}>{label}</p>
              <p className="text-sm font-mono" style={{ color: '#1B5E20' }}>{value}</p>
            </div>
            <button onClick={() => copy(value, key)} className="p-2 rounded-lg hover:bg-green-50">
              {copiedField === key ? <Check size={14} style={{ color: '#2E7D32' }} /> : <Copy size={14} style={{ color: '#2E7D32' }} />}
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs mt-3" style={{ color: '#388E3C' }}>
        ⚠️ Copy and securely distribute these credentials. The password will not be shown again.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminPortalContent() {
  const { user } = useAuth();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<TabId>('directory');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [mentors, setMentors] = useState<MentorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [generatedCredentials, setGeneratedCredentials] = useState<{ email: string; password: string; name: string } | null>(null);

  // ── Create Mentor form ──
  const [mentorForm, setMentorForm] = useState({
    full_name: '', email: '', password: '', pillars: [] as string[],
  });
  const [creatingMentor, setCreatingMentor] = useState(false);
  const [showMentorPwd, setShowMentorPwd] = useState(false);

  // ── Create Student+Parent form ──
  const [studentForm, setStudentForm] = useState({
    student_name: '', student_age: '', student_gender: '',
    student_email: '', student_password: '',
    parent_name: '', parent_email: '',
    grade: '', primary_topics: [] as string[],
  });
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [showStudentPwd, setShowStudentPwd] = useState(false);

  // ── Assign form ──
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignMentorId, setAssignMentorId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // ── Edit modal ──
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // ── Reset password modal ──
  const [resetUser, setResetUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPwd, setResettingPwd] = useState(false);

  // ─── Data fetching ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, studentsRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, email, full_name, role, created_at, mentor_pillars, student_id')
          .order('created_at', { ascending: false }),
        supabase
          .from('students')
          .select('id, name, student_code, grade, mentor_id, parent_name, parent_email, student_email, student_user_id'),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (studentsRes.error) throw studentsRes.error;

      const allUsers: UserProfile[] = usersRes.data || [];
      const allStudents: StudentRecord[] = studentsRes.data || [];

      // Enrich students with mentor name
      const mentorMap: Record<string, string> = {};
      allUsers.filter((u) => u.role === 'mentor').forEach((m) => {
        mentorMap[m.id] = m.full_name;
      });

      const enrichedStudents = allStudents.map((s) => ({
        ...s,
        mentor_name: s.mentor_id ? (mentorMap[s.mentor_id] || 'Unknown Mentor') : undefined,
      }));

      setUsers(allUsers);
      setStudents(enrichedStudents);
      setMentors(
        allUsers
          .filter((u) => u.role === 'mentor')
          .map((u) => ({ id: u.id, full_name: u.full_name, email: u.email, mentor_pillars: u.mentor_pillars || [] }))
      );
    } catch (err: any) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Real-time: auto-refresh when users, students, sessions, or meetings change ──
  useRealtimeSubscription([
    { table: 'sessions',   onRefresh: fetchAll },
    { table: 'attendance', onRefresh: fetchAll },
    { table: 'meetings',   onRefresh: fetchAll },
    { table: 'student_reflections', onRefresh: fetchAll },
  ]);

  // ─── Create Mentor ─────────────────────────────────────────────────────────
  const handleCreateMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentorForm.full_name || !mentorForm.email || !mentorForm.password) {
      toast.error('Please fill in all required fields');
      return;
    }
    setCreatingMentor(true);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create_mentor',
          email: mentorForm.email,
          password: mentorForm.password,
          full_name: mentorForm.full_name,
          pillars: mentorForm.pillars,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create mentor');

      setGeneratedCredentials({ email: mentorForm.email, password: mentorForm.password, name: mentorForm.full_name });
      toast.success(`Mentor "${mentorForm.full_name}" created!`);
      setMentorForm({ full_name: '', email: '', password: '', pillars: [] });
      fetchAll();
      setActiveTab('directory');
    } catch (err: any) {
      toast.error('Failed to create mentor: ' + err.message);
    } finally {
      setCreatingMentor(false);
    }
  };

  const togglePillar = (pillar: string) => {
    setMentorForm((f) => ({
      ...f,
      pillars: f.pillars.includes(pillar) ? f.pillars.filter((p) => p !== pillar) : [...f.pillars, pillar],
    }));
  };

  // ─── Create Student + Parent ───────────────────────────────────────────────
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.student_name || !studentForm.student_email || !studentForm.student_password) {
      toast.error('Student name, email, and password are required');
      return;
    }
    setCreatingStudent(true);
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'create_student',
          student_name: studentForm.student_name,
          student_email: studentForm.student_email,
          student_password: studentForm.student_password,
          student_age: studentForm.student_age,
          student_gender: studentForm.student_gender,
          grade: studentForm.grade,
          primary_topics: studentForm.primary_topics,
          parent_name: studentForm.parent_name,
          parent_email: studentForm.parent_email,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to create student');

      setGeneratedCredentials({ email: studentForm.student_email, password: studentForm.student_password, name: studentForm.student_name });
      toast.success(`Student "${studentForm.student_name}" and parent profile created!`);
      setStudentForm({
        student_name: '', student_age: '', student_gender: '',
        student_email: '', student_password: '',
        parent_name: '', parent_email: '',
        grade: '', primary_topics: [],
      });
      fetchAll();
      setActiveTab('directory');
    } catch (err: any) {
      toast.error('Failed to create student: ' + err.message);
    } finally {
      setCreatingStudent(false);
    }
  };

  // ─── Assign Mentor to Student ──────────────────────────────────────────────
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStudentId || !assignMentorId) {
      toast.error('Please select both a student and a mentor');
      return;
    }
    setAssigning(true);
    try {
      // Update mentor_id on the student record
      const { error } = await supabase
        .from('students')
        .update({ mentor_id: assignMentorId })
        .eq('id', assignStudentId);
      if (error) throw error;

      // Also ensure the student's user_profiles.student_id is linked
      // (in case it was missing for existing students like Sneha)
      const targetStudent = students.find((s) => s.id === assignStudentId);
      if (targetStudent?.student_email) {
        const { data: profileRow } = await supabase
          .from('user_profiles')
          .select('id, student_id')
          .eq('email', targetStudent.student_email)
          .maybeSingle();
        if (profileRow && !profileRow.student_id) {
          await supabase
            .from('user_profiles')
            .update({ student_id: assignStudentId })
            .eq('id', profileRow.id);
        }
        // Also ensure student_user_id is set on the student record
        if (profileRow && !targetStudent.student_email) {
          await supabase
            .from('students')
            .update({ student_user_id: profileRow.id })
            .eq('id', assignStudentId);
        }
      }

      const mentor = mentors.find((m) => m.id === assignMentorId);
      const student = students.find((s) => s.id === assignStudentId);
      toast.success(`${student?.name} assigned to ${mentor?.full_name}!`);
      setAssignStudentId('');
      setAssignMentorId('');
      fetchAll();
    } catch (err: any) {
      toast.error('Assignment failed: ' + err.message);
    } finally {
      setAssigning(false);
    }
  };

  // ─── Edit User ─────────────────────────────────────────────────────────────
  const openEdit = (u: UserProfile) => {
    setEditUser(u);
    setEditName(u.full_name);
    setEditRole(u.role);
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ full_name: editName, role: editRole })
        .eq('id', editUser.id);
      if (error) throw error;
      toast.success('Profile updated!');
      setEditUser(null);
      fetchAll();
    } catch (err: any) {
      toast.error('Update failed: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // ─── Reset Password ────────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!resetUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setResettingPwd(true);
    try {
      // Send password reset email (admin flow)
      const { error } = await supabase.auth.resetPasswordForEmail(resetUser.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      });
      if (error) throw error;
      toast.success(`Password reset email sent to ${resetUser.email}`);
      setResetUser(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error('Reset failed: ' + err.message);
    } finally {
      setResettingPwd(false);
    }
  };

  // ─── Re-assign Mentor (quick) ──────────────────────────────────────────────
  const handleReassign = async (studentId: string, newMentorId: string) => {
    try {
      const { error } = await supabase.from('students').update({ mentor_id: newMentorId || null }).eq('id', studentId);
      if (error) throw error;
      toast.success('Mentor re-assigned!');
      fetchAll();
    } catch (err: any) {
      toast.error('Re-assign failed: ' + err.message);
    }
  };

  // ─── Filtered users ────────────────────────────────────────────────────────
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const getRoleInfo = (role: string) => ROLES.find((r) => r.value === role) || ROLES[0];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
          <Shield size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Tech Admin Portal</h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Manage users, assign mentors, and provision credentials
          </p>
        </div>
      </div>

      {/* Credentials card */}
      {generatedCredentials && (
        <CredentialsCard credentials={generatedCredentials} onDismiss={() => setGeneratedCredentials(null)} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl overflow-x-auto" style={{ background: 'var(--secondary)', border: '1.5px solid var(--border)' }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-600 transition-all whitespace-nowrap flex-shrink-0"
              style={{
                fontWeight: 600,
                background: isActive ? 'var(--card)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab: User Directory ── */}
      {activeTab === 'directory' && (
        <div className="rounded-2xl card-glow overflow-hidden" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
          {/* Directory header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 flex-1">
              <Users size={16} style={{ color: 'var(--primary)' }} />
              <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
                All Users ({filteredUsers.length})
              </h2>
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  type="text"
                  className="input-mystic pl-8 py-1.5 text-sm"
                  placeholder="Search name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ minWidth: 180 }}
                />
              </div>
              {/* Role filter */}
              <select
                className="input-mystic py-1.5 text-sm"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <button onClick={fetchAll} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Refresh">
                <RefreshCw size={14} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: 'var(--primary)' }} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ color: 'var(--primary)' }} />
              </svg>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users size={32} style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--secondary)' }}>
                    {['Name', 'Email', 'Role', 'Assignment Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-600" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const roleInfo = getRoleInfo(u.role);
                    // Find linked student for student_parent users
                    const linkedStudent = u.role === 'student_parent'
                      ? students.find((s) => s.id === u.student_id || s.student_email === u.email)
                      : null;
                    // For mentors, count assigned students
                    const assignedCount = u.role === 'mentor'
                      ? students.filter((s) => s.mentor_id === u.id).length
                      : 0;

                    return (
                      <tr key={u.id} className="border-t transition-colors hover:bg-muted/30" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: 'var(--gradient-primary)', color: 'white' }}>
                              {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span className="text-sm font-500" style={{ color: 'var(--foreground)' }}>{u.full_name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>{u.email}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-600 px-2 py-1 rounded-full" style={{ background: roleInfo.bg, color: roleInfo.color, fontWeight: 600 }}>
                            {roleInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.role === 'mentor' && (
                            <span className="text-xs" style={{ color: assignedCount > 0 ? '#2E7D32' : 'var(--muted-foreground)' }}>
                              {assignedCount > 0 ? `${assignedCount} student${assignedCount > 1 ? 's' : ''} assigned` : 'No students assigned'}
                            </span>
                          )}
                          {u.role === 'student_parent' && (
                            <span className="text-xs" style={{ color: linkedStudent?.mentor_id ? '#2E7D32' : '#C62828' }}>
                              {linkedStudent
                                ? linkedStudent.mentor_name
                                  ? `Assigned Mentor: ${linkedStudent.mentor_name}`
                                  : '⚠ No mentor assigned' :'⚠ No student linked'}
                            </span>
                          )}
                          {u.role === 'admin' && (
                            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Admin access</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(u)}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                              title="Edit Profile"
                            >
                              <Edit3 size={13} style={{ color: 'var(--primary)' }} />
                            </button>
                            {u.role === 'student_parent' && linkedStudent && (
                              <button
                                onClick={() => { setAssignStudentId(linkedStudent.id); setActiveTab('assign'); }}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                title="Re-assign Mentor"
                              >
                                <Link2 size={13} style={{ color: '#7C6EAA' }} />
                              </button>
                            )}
                            <button
                              onClick={() => { setResetUser(u); setNewPassword(''); }}
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                              title="Reset Credentials"
                            >
                              <Key size={13} style={{ color: '#E65100' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Create Mentor ── */}
      {activeTab === 'create-mentor' && (
        <div className="rounded-2xl p-6 card-glow" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-5">
            <BookOpen size={18} style={{ color: 'var(--primary)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Create Mentor Account</h2>
          </div>
          <form onSubmit={handleCreateMentor} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Full Name *</label>
                <input type="text" className="input-mystic" placeholder="e.g. Priya Sharma"
                  value={mentorForm.full_name} onChange={(e) => setMentorForm((f) => ({ ...f, full_name: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Email Address *</label>
                <input type="email" className="input-mystic" placeholder="mentor@luminar.guide"
                  value={mentorForm.email} onChange={(e) => setMentorForm((f) => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Password *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input type={showMentorPwd ? 'text' : 'password'} className="input-mystic pr-10"
                      placeholder="Set a secure password" value={mentorForm.password}
                      onChange={(e) => setMentorForm((f) => ({ ...f, password: e.target.value }))} required />
                    <button type="button" onClick={() => setShowMentorPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">
                      {showMentorPwd ? <EyeOff size={15} style={{ color: 'var(--muted-foreground)' }} /> : <Eye size={15} style={{ color: 'var(--muted-foreground)' }} />}
                    </button>
                  </div>
                  <button type="button" onClick={() => setMentorForm((f) => ({ ...f, password: generatePassword(f.full_name) }))}
                    className="btn-secondary flex items-center gap-1 px-3 flex-shrink-0">
                    <RefreshCw size={14} /><span className="text-xs">Generate</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Pillars */}
            <div>
              <label className="block text-sm font-600 mb-2" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                Assigned Pillars / Subjects
              </label>
              <div className="flex flex-wrap gap-2">
                {EDUCATIONAL_PILLARS.map((p) => {
                  const selected = mentorForm.pillars.includes(p);
                  return (
                    <button key={p} type="button" onClick={() => togglePillar(p)}
                      className="px-3 py-1.5 rounded-full text-xs font-600 transition-all"
                      style={{
                        fontWeight: 600,
                        background: selected ? 'var(--primary)' : 'var(--secondary)',
                        color: selected ? 'white' : 'var(--muted-foreground)',
                        border: '1.5px solid',
                        borderColor: selected ? 'var(--primary)' : 'var(--border)',
                      }}>
                      {p}
                    </button>
                  );
                })}
              </div>
              {mentorForm.pillars.length === 0 && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>Select one or more pillars this mentor will cover</p>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button type="submit" disabled={creatingMentor} className="btn-primary flex items-center gap-2">
                {creatingMentor ? (
                  <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <UserPlus size={15} />}
                Create Mentor Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tab: Create Student & Parent ── */}
      {activeTab === 'create-student' && (
        <div className="rounded-2xl p-6 card-glow" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-5">
            <GraduationCap size={18} style={{ color: 'var(--primary)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Create Student & Parent Profile</h2>
          </div>
          <form onSubmit={handleCreateStudent} className="flex flex-col gap-5">
            {/* Student section */}
            <div>
              <p className="text-xs font-700 uppercase tracking-wider mb-3" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                Student Details
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Student Full Name *</label>
                  <input type="text" className="input-mystic" placeholder="e.g. Riya Chaudhary"
                    value={studentForm.student_name} onChange={(e) => setStudentForm((f) => ({ ...f, student_name: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Student Email *</label>
                  <input type="email" className="input-mystic" placeholder="student@luminar.guide"
                    value={studentForm.student_email} onChange={(e) => setStudentForm((f) => ({ ...f, student_email: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Age</label>
                  <input type="number" min="5" max="30" className="input-mystic" placeholder="e.g. 14"
                    value={studentForm.student_age} onChange={(e) => setStudentForm((f) => ({ ...f, student_age: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Gender</label>
                  <select className="input-mystic" value={studentForm.student_gender} onChange={(e) => setStudentForm((f) => ({ ...f, student_gender: e.target.value }))}>
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Grade / Year</label>
                  <select className="input-mystic" value={studentForm.grade} onChange={(e) => setStudentForm((f) => ({ ...f, grade: e.target.value }))}>
                    <option value="">Select...</option>
                    {['Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12','Year 1','Year 2','Year 3'].map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-600 mb-2" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                    Focus Pillars (select one or more)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {EDUCATIONAL_PILLARS.map((p) => {
                      const selected = studentForm.primary_topics.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() =>
                            setStudentForm((f) => ({
                              ...f,
                              primary_topics: selected
                                ? f.primary_topics.filter((x) => x !== p)
                                : [...f.primary_topics, p],
                            }))
                          }
                          className="px-3 py-1.5 rounded-full text-xs font-600 transition-all"
                          style={{
                            fontWeight: 600,
                            background: selected ? 'var(--primary)' : 'var(--secondary)',
                            color: selected ? 'white' : 'var(--muted-foreground)',
                            border: '1.5px solid',
                            borderColor: selected ? 'var(--primary)' : 'var(--border)',
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                  {studentForm.primary_topics.length === 0 && (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                      Select one or more educational pillars for this student
                    </p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Student Login Password *</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input type={showStudentPwd ? 'text' : 'password'} className="input-mystic pr-10"
                        placeholder="Set login password" value={studentForm.student_password}
                        onChange={(e) => setStudentForm((f) => ({ ...f, student_password: e.target.value }))} required />
                      <button type="button" onClick={() => setShowStudentPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">
                        {showStudentPwd ? <EyeOff size={15} style={{ color: 'var(--muted-foreground)' }} /> : <Eye size={15} style={{ color: 'var(--muted-foreground)' }} />}
                      </button>
                    </div>
                    <button type="button" onClick={() => setStudentForm((f) => ({ ...f, student_password: generatePassword(f.student_name) }))}
                      className="btn-secondary flex items-center gap-1 px-3 flex-shrink-0">
                      <RefreshCw size={14} /><span className="text-xs">Generate</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Parent section */}
            <div>
              <p className="text-xs font-700 uppercase tracking-wider mb-3" style={{ color: '#7C6EAA', fontWeight: 700 }}>
                Parent / Guardian Details
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Parent Name</label>
                  <input type="text" className="input-mystic" placeholder="e.g. Sunita Chaudhary"
                    value={studentForm.parent_name} onChange={(e) => setStudentForm((f) => ({ ...f, parent_name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Parent Email</label>
                  <input type="email" className="input-mystic" placeholder="parent@example.com"
                    value={studentForm.parent_email} onChange={(e) => setStudentForm((f) => ({ ...f, parent_email: e.target.value }))} />
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
                The student login credentials above will be used for the Student/Parent Dashboard. Parent details are stored on the student profile.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button type="submit" disabled={creatingStudent} className="btn-primary flex items-center gap-2">
                {creatingStudent ? (
                  <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : <GraduationCap size={15} />}
                Create Student & Parent Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tab: Assign Mentor ── */}
      {activeTab === 'assign' && (
        <div className="flex flex-col gap-6">
          {/* Assignment form */}
          <div className="rounded-2xl p-6 card-glow" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-5">
              <Link2 size={18} style={{ color: 'var(--primary)' }} />
              <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Assign Mentor to Student</h2>
            </div>
            <form onSubmit={handleAssign} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Select Student *</label>
                <select className="input-mystic" value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)} required>
                  <option value="">Choose a student...</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.student_code}) {s.mentor_name ? `— Currently: ${s.mentor_name}` : '— Unassigned'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Assign Mentor *</label>
                <select className="input-mystic" value={assignMentorId} onChange={(e) => setAssignMentorId(e.target.value)} required>
                  <option value="">Choose a mentor...</option>
                  {mentors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" disabled={assigning} className="btn-primary flex items-center gap-2">
                  {assigning ? (
                    <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : <UserCheck size={15} />}
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>

          {/* Current assignments table */}
          <div className="rounded-2xl card-glow overflow-hidden" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
              <UserCheck size={16} style={{ color: 'var(--primary)' }} />
              <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>Current Assignments ({students.length})</h3>
            </div>
            {students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <AlertCircle size={28} style={{ color: 'var(--muted-foreground)' }} />
                <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>No students found. Create students first.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'var(--secondary)' }}>
                      {['Student', 'Code', 'Grade', 'Assigned Mentor', 'Re-assign'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-600" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id} className="border-t hover:bg-muted/30 transition-colors" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-4 py-3 text-sm font-500" style={{ color: 'var(--foreground)' }}>{s.name}</td>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{s.student_code}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{s.grade}</td>
                        <td className="px-4 py-3">
                          {s.mentor_name ? (
                            <span className="text-xs font-600 px-2 py-1 rounded-full" style={{ background: '#E8F5E9', color: '#2E7D32', fontWeight: 600 }}>
                              ✓ {s.mentor_name}
                            </span>
                          ) : (
                            <span className="text-xs font-600 px-2 py-1 rounded-full" style={{ background: '#FDECEA', color: '#C62828', fontWeight: 600 }}>
                              ⚠ Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="input-mystic py-1 text-xs"
                            value={s.mentor_id || ''}
                            onChange={(e) => handleReassign(s.id, e.target.value)}
                            style={{ minWidth: 160 }}
                          >
                            <option value="">— Remove assignment —</option>
                            {mentors.map((m) => (
                              <option key={m.id} value={m.id}>{m.full_name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(45,37,80,0.4)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 card-glow" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ color: 'var(--foreground)' }}>Edit Profile</h3>
              <button onClick={() => setEditUser(null)} className="p-1.5 rounded-lg hover:bg-muted">
                <X size={16} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Full Name</label>
                <input type="text" className="input-mystic" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Role</label>
                <select className="input-mystic" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditUser(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleSaveEdit} disabled={savingEdit} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {savingEdit ? <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <Check size={14} />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Credentials Modal ── */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(45,37,80,0.4)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 card-glow" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ color: 'var(--foreground)' }}>Reset Credentials</h3>
              <button onClick={() => setResetUser(null)} className="p-1.5 rounded-lg hover:bg-muted">
                <X size={16} style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
              A password reset email will be sent to <strong style={{ color: 'var(--foreground)' }}>{resetUser.email}</strong>.
              The user must click the link to set a new password.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setResetUser(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleResetPassword} disabled={resettingPwd} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {resettingPwd ? <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> : <Key size={14} />}
                Send Reset Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
