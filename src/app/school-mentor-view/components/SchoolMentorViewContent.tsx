'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Eye, Users, BarChart2, BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MentorInfo {
  id: string;
  full_name: string;
  email: string;
}

interface StudentRow {
  id: string;
  name: string;
  grade: string;
  avg_score: number;
  sessions: number;
}

export default function SchoolMentorViewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mentorId = searchParams.get('mentorId');
  const supabase = createClient();

  const [mentor, setMentor] = useState<MentorInfo | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mentorId) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data: m } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .eq('id', mentorId)
          .single();
        setMentor(m);

        const { data: studentRows } = await supabase
          .from('students')
          .select('id, name, grade, avg_score, sessions')
          .eq('mentor_id', mentorId)
          .order('name');
        setStudents(studentRows || []);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load mentor data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [mentorId]);

  const avgScore = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.avg_score, 0) / students.length)
    : 0;

  const chartData = students.map((s) => ({ name: s.name.split(' ')[0], score: s.avg_score }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 rounded-full border-4" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className="text-center py-20">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Mentor not found.</p>
        <button onClick={() => router.back()} className="btn-secondary mt-4 text-sm flex items-center gap-2 mx-auto">
          <ArrowLeft size={14} /> Back
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-muted transition-colors" aria-label="Go back">
          <ArrowLeft size={18} style={{ color: 'var(--muted-foreground)' }} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Eye size={16} style={{ color: 'var(--primary)' }} />
            <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
              {mentor.full_name} — Read-Only Analytics
            </h1>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{mentor.email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Students', value: students.length, icon: Users, color: '#7C6EAA' },
          { label: 'Avg Score', value: `${avgScore}%`, icon: BarChart2, color: '#1565C0' },
          { label: 'Total Sessions', value: students.reduce((s, r) => s + r.sessions, 0), icon: BookOpen, color: '#2E7D32' },
        ].map((m) => {
          const MIcon = m.icon;
          return (
            <div key={m.label} className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: m.color + '22' }}>
                <MIcon size={15} style={{ color: m.color }} />
              </div>
              <p className="text-xl font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>{m.value}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{m.label}</p>
            </div>
          );
        })}
      </div>

      {/* Student Score Chart */}
      {chartData.length > 0 && (
        <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            Student Performance
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                formatter={(v: any) => [`${v}%`, 'Score']}
              />
              <Bar dataKey="score" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Student List */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
          Student Roster
        </h3>
        {students.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No students linked to this mentor.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {students.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--gradient-primary)', color: 'white' }}>
                  {s.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)', fontWeight: 700 }}>{s.name}</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Grade {s.grade} · {s.sessions} sessions</p>
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--primary-dark)', fontWeight: 700 }}>{s.avg_score}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
