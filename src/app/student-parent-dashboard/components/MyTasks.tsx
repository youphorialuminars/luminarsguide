'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Star, Calendar, RefreshCw, ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Task {
  id: string;
  task_description: string;
  priority_rating: number;
  deadline: string | null;
  status: string;
  created_at: string;
}

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'] as const;

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  Pending: { bg: '#FFF8E1', color: '#F59E0B', border: '#FAE8A0' },
  'In Progress': { bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9' },
  Completed: { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' },
};

function PriorityStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((s) => (
        <Star
          key={s}
          size={12}
          fill={s <= value ? '#F59E0B' : 'none'}
          style={{ color: s <= value ? '#F59E0B' : 'var(--border)' }}
        />
      ))}
    </div>
  );
}

export default function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);

  const resolveStudentId = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    const supabase = createClient();

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('student_id')
      .eq('id', user.id)
      .single();

    if (profile?.student_id) return profile.student_id;

    const { data: student } = await supabase
      .from('students')
      .select('id')
      .or(`student_user_id.eq.${user.id},student_email.eq.${user.email}`)
      .limit(1)
      .maybeSingle();

    return student?.id || null;
  }, [user]);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    const sid = studentId || (await resolveStudentId());
    if (!sid) {
      setLoading(false);
      return;
    }
    if (!studentId) setStudentId(sid);

    const { data, error } = await supabase
      .from('student_tasks')
      .select('id, task_description, priority_rating, deadline, status, created_at')
      .eq('student_id', sid)
      .order('created_at', { ascending: false });

    if (!error) {
      setTasks(data || []);
    }
    setLoading(false);
  }, [user, studentId, resolveStudentId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setUpdatingId(taskId);
    const supabase = createClient();
    const { error } = await supabase
      .from('student_tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      toast.error(error.message || 'Failed to update status');
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      toast.success(`Task marked as "${newStatus}" ✅`);
    }
    setUpdatingId(null);
  };

  const priorityLabel = (p: number) => (p === 3 ? 'High' : p === 2 ? 'Medium' : 'Low');

  const isOverdue = (deadline: string | null, status: string) => {
    if (!deadline || status === 'Completed') return false;
    return new Date(deadline) < new Date();
  };

  return (
    <div className="rounded-2xl p-5 card-glow" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--accent-light)' }}
        >
          <CheckSquare size={18} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            My Tasks
          </h2>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Tasks assigned by your mentor — update your status as you progress
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--secondary)' }} />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: 'var(--secondary)', border: '1.5px dashed var(--border)' }}
        >
          <CheckSquare size={24} className="mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            No tasks yet
          </p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Your mentor hasn&apos;t assigned any tasks yet. Check back after your next session!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => {
            const statusStyle = STATUS_COLORS[task.status] || STATUS_COLORS['Pending'];
            const overdue = isOverdue(task.deadline, task.status);

            return (
              <div
                key={task.id}
                className="rounded-xl p-4"
                style={{
                  background: 'var(--secondary)',
                  border: `1px solid ${overdue ? '#FFCDD2' : 'var(--border)'}`,
                }}
              >
                {/* Top row: priority + status badge */}
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <PriorityStars value={task.priority_rating} />
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {priorityLabel(task.priority_rating)} Priority
                    </span>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: statusStyle.bg,
                      color: statusStyle.color,
                      border: `1px solid ${statusStyle.border}`,
                    }}
                  >
                    {task.status}
                  </span>
                </div>

                {/* Task description */}
                <p className="text-sm mb-2" style={{ color: 'var(--foreground)' }}>
                  {task.task_description}
                </p>

                {/* Deadline */}
                {task.deadline && (
                  <div className="flex items-center gap-1 mb-3">
                    <Calendar size={11} style={{ color: overdue ? '#C62828' : 'var(--muted-foreground)' }} />
                    <span
                      className="text-xs"
                      style={{ color: overdue ? '#C62828' : 'var(--muted-foreground)', fontWeight: overdue ? 700 : 400 }}
                    >
                      {overdue ? '⚠️ Overdue — ' : 'Due: '}
                      {new Date(task.deadline).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}

                {/* Status dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Update status:
                  </span>
                  <div className="relative flex-1 max-w-[160px]">
                    <select
                      className="input-mystic text-xs pr-7 appearance-none cursor-pointer"
                      value={task.status}
                      disabled={updatingId === task.id}
                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                      style={{ paddingTop: '6px', paddingBottom: '6px' }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                      {updatingId === task.id ? (
                        <RefreshCw size={11} className="animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                      ) : (
                        <ChevronDown size={11} style={{ color: 'var(--muted-foreground)' }} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
