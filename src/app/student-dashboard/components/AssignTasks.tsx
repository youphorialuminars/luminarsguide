'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Plus, Trash2, RefreshCw, Star, Calendar, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
}

interface Task {
  id: string;
  student_id: string;
  student_name?: string;
  task_description: string;
  priority_rating: number;
  deadline: string | null;
  status: string;
  created_at: string;
}

interface AssignTasksProps {
  /** Pre-fill tasks from AI session analysis */
  aiTasks?: string[];
  /** Pre-select a student */
  defaultStudentId?: string;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110"
        >
          <Star
            size={18}
            fill={star <= value ? '#F59E0B' : 'none'}
            style={{ color: star <= value ? '#F59E0B' : 'var(--border)' }}
          />
        </button>
      ))}
    </div>
  );
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Pending: { bg: '#FFF8E1', color: '#F59E0B' },
  'In Progress': { bg: '#E3F2FD', color: '#1565C0' },
  Completed: { bg: '#E8F5E9', color: '#2E7D32' },
};

export default function AssignTasks({ aiTasks = [], defaultStudentId }: AssignTasksProps) {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [selectedStudentId, setSelectedStudentId] = useState(defaultStudentId || '');
  const [taskDescription, setTaskDescription] = useState('');
  const [priorityRating, setPriorityRating] = useState(1);
  const [deadline, setDeadline] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // AI task quick-assign
  const [selectedAiTask, setSelectedAiTask] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    const [studResult, taskResult] = await Promise.all([
      supabase.from('students').select('id, name').eq('mentor_id', user.id).order('name'),
      supabase
        .from('student_tasks')
        .select('id, student_id, task_description, priority_rating, deadline, status, created_at')
        .eq('mentor_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    const studList = studResult.data || [];
    setStudents(studList);

    // Enrich tasks with student names
    const enriched = (taskResult.data || []).map((t) => ({
      ...t,
      student_name: studList.find((s) => s.id === t.student_id)?.name || 'Unknown',
    }));
    setTasks(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // When AI task is selected, pre-fill description
  useEffect(() => {
    if (selectedAiTask) {
      setTaskDescription(selectedAiTask);
      setShowForm(true);
    }
  }, [selectedAiTask]);

  const handleAssign = async () => {
    if (!selectedStudentId) {
      toast.error('Please select a student');
      return;
    }
    if (!taskDescription.trim()) {
      toast.error('Please enter a task description');
      return;
    }
    if (!user) return;
    setAssigning(true);
    const supabase = createClient();
    const { error } = await supabase.from('student_tasks').insert({
      student_id: selectedStudentId,
      mentor_id: user.id,
      task_description: taskDescription.trim(),
      priority_rating: priorityRating,
      deadline: deadline || null,
      status: 'Pending',
    });
    if (error) {
      toast.error(error.message || 'Failed to assign task');
    } else {
      toast.success('Task assigned to student! 🎯');
      setTaskDescription('');
      setPriorityRating(1);
      setDeadline('');
      setSelectedAiTask('');
      setShowForm(false);
      fetchData();
    }
    setAssigning(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const supabase = createClient();
    const { error } = await supabase.from('student_tasks').delete().eq('id', id);
    if (error) {
      toast.error(error.message || 'Failed to delete task');
    } else {
      toast.success('Task removed');
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
    setDeletingId(null);
  };

  const priorityLabel = (p: number) => (p === 3 ? 'High' : p === 2 ? 'Medium' : 'Low');

  return (
    <div className="rounded-2xl p-5 card-glow" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent-light)' }}
          >
            <CheckSquare size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
              Assign Tasks
            </h2>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Assign tasks to students with priority and deadline
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {showForm ? <ChevronUp size={14} /> : <Plus size={14} />}
          {showForm ? 'Hide Form' : 'New Task'}
        </button>
      </div>

      {/* AI Tasks quick-pick */}
      {aiTasks.length > 0 && (
        <div
          className="rounded-xl p-3 mb-4"
          style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-bold mb-2" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            ✨ AI-Generated Tasks — click to assign
          </p>
          <div className="flex flex-col gap-1.5">
            {aiTasks.map((task, i) => (
              <button
                key={i}
                onClick={() => setSelectedAiTask(task)}
                className="text-left text-xs px-3 py-2 rounded-lg transition-colors hover:opacity-80"
                style={{
                  background: selectedAiTask === task ? 'var(--accent-light)' : 'var(--card)',
                  border: `1px solid ${selectedAiTask === task ? 'var(--primary)' : 'var(--border)'}`,
                  color: 'var(--foreground)',
                }}
              >
                {i + 1}. {task}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Assign form */}
      {showForm && (
        <div
          className="rounded-xl p-4 mb-5 space-y-3"
          style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
        >
          <p className="text-xs font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            Assign New Task
          </p>

          {/* Student select */}
          <select
            className="input-mystic"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
          >
            <option value="">Select student...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Task description */}
          <textarea
            className="input-mystic resize-none"
            rows={3}
            placeholder="Describe the task clearly and specifically..."
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
          />

          {/* Priority & Deadline row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                Priority Rating
              </label>
              <div className="flex items-center gap-2">
                <StarRating value={priorityRating} onChange={setPriorityRating} />
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {priorityLabel(priorityRating)}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                Deadline (optional)
              </label>
              <div className="flex items-center gap-2">
                <Calendar size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                <input
                  type="date"
                  className="input-mystic flex-1"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleAssign}
            disabled={assigning || !selectedStudentId || !taskDescription.trim()}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {assigning ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <CheckSquare size={14} />
            )}
            {assigning ? 'Assigning...' : 'Assign Task'}
          </button>
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--secondary)' }} />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: 'var(--secondary)', border: '1.5px dashed var(--border)' }}
        >
          <CheckSquare size={24} className="mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            No tasks assigned yet
          </p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Click &quot;New Task&quot; above to assign a task to a student.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => {
            const statusStyle = STATUS_COLORS[task.status] || STATUS_COLORS['Pending'];
            return (
              <div
                key={task.id}
                className="rounded-xl p-3"
                style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold" style={{ color: 'var(--primary-dark)' }}>
                        {task.student_name}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: statusStyle.bg, color: statusStyle.color }}
                      >
                        {task.status}
                      </span>
                      {/* Priority stars */}
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            size={11}
                            fill={s <= task.priority_rating ? '#F59E0B' : 'none'}
                            style={{ color: s <= task.priority_rating ? '#F59E0B' : 'var(--border)' }}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--foreground)' }}>
                      {task.task_description}
                    </p>
                    {task.deadline && (
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar size={10} style={{ color: 'var(--muted-foreground)' }} />
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          Due: {new Date(task.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(task.id)}
                    disabled={deletingId === task.id}
                    className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:opacity-70"
                    style={{ background: '#FDECEA', color: '#C62828' }}
                    title="Delete task"
                  >
                    {deletingId === task.id ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
