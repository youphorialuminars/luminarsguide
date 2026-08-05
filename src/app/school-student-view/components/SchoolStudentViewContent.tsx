'use client';
import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Eye, Users, BarChart2, CheckSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface StudentInfo {
  id: string;
  name: string;
  grade: string;
  avg_score: number;
  sessions: number;
  primary_topic: string;
  trend: string;
}

interface TaskRow {
  id: string;
  task_description: string;
  priority_rating: number;
  deadline: string | null;
  status: string;
}

interface AttendanceSummary {
  total: number;
  present: number;
}

export default function SchoolStudentViewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const studentId = searchParams.get('studentId');
  const supabase = createClient();

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary>({ total: 0, present: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data: s } = await supabase
          .from('students')
          .select('id, name, grade, avg_score, sessions, primary_topic, trend')
          .eq('id', studentId)
          .single();
        setStudent(s);

        const { data: taskRows } = await supabase
          .from('student_tasks')
          .select('id, task_description, priority_rating, deadline, status')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false });
        setTasks(taskRows || []);

        const { data: attRows } = await supabase
          .from('attendance')
          .select('status')
          .eq('student_id', studentId);
        const total = attRows?.length ?? 0;
        const present = attRows?.filter((r) => r.status === 'present').length ?? 0;
        setAttendance({ total, present });
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load student data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [studentId]);

  const attendanceRate = attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0;
  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 rounded-full border-4 border-primary border-t-transparent" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-20">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Student not found.</p>
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
              {student.name} — Read-Only View
            </h1>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Grade {student.grade} · {student.primary_topic}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Avg Score', value: `${student.avg_score}%`, icon: BarChart2, color: '#7C6EAA' },
          { label: 'Sessions', value: student.sessions, icon: Users, color: '#1565C0' },
          { label: 'Attendance', value: `${attendanceRate}%`, icon: CheckSquare, color: '#2E7D32' },
          { label: 'Tasks Done', value: `${completedTasks}/${tasks.length}`, icon: CheckSquare, color: '#E65100' },
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

      {/* Task List */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
          Assigned Tasks
        </h3>
        {tasks.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No tasks assigned yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>{t.task_description}</p>
                  {t.deadline && (
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Due: {t.deadline}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{
                    background: t.status === 'Completed' ? '#E8F5E9' : t.status === 'In Progress' ? '#E3F2FD' : 'var(--muted)',
                    color: t.status === 'Completed' ? '#2E7D32' : t.status === 'In Progress' ? '#1565C0' : 'var(--muted-foreground)',
                    fontWeight: 700,
                  }}>
                    {t.status}
                  </span>
                  <span className="text-xs" style={{ color: '#F59E0B' }}>{'★'.repeat(t.priority_rating)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
