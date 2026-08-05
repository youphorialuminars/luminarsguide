'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, UserPlus, Copy, CheckCheck, Key } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AddStudentValues {
  fullName: string;
  studentId: string;
  grade: string;
  primaryTopic: string;
  age: string;
  gender: string;
  notes: string;
}

interface AddStudentModalProps {
  onClose: () => void;
  onStudentAdded?: () => void;
}

const EDUCATIONAL_PILLARS = [
  'Teamwork and Leadership',
  'Digital Hygiene and Privacy Literacy',
  'Emotional Resilience and Mental Well-being',
  'Personal Safety, Consent, and Boundaries',
  'Civic Sense and Social Responsibility',
];

export default function AddStudentModal({ onClose, onStudentAdded }: AddStudentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<AddStudentValues>();

  const onSubmit = async (data: AddStudentValues) => {
    if (!user) {
      toast.error('You must be signed in to register a student.');
      return;
    }
    setIsLoading(true);
    try {
      const supabase = createClient();

      const { data: rpcData, error: rpcError } = await supabase.rpc('mentor_create_student_with_invite', {
        p_name: data.fullName,
        p_student_id: data.studentId,
        p_grade: data.grade || '',
        p_primary_topic: data.primaryTopic || '',
        p_age: data.age ? Number(data.age) : null,
        p_gender: data.gender || '',
        p_notes: data.notes || '',
      });

      if (rpcError || !rpcData?.success) {
        toast.error(rpcData?.error || rpcError?.message || 'Failed to register student.');
        return;
      }

      setInviteCode(rpcData.invite_code as string);
      onStudentAdded?.();
      toast.success(`${data.fullName} registered! Share the invite code below.`);
    } catch (err: any) {
      toast.error(err?.message ?? 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Invite code copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  // ── Invite code success screen ────────────────────────────────────────────
  if (inviteCode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(45, 37, 80, 0.4)', backdropFilter: 'blur(6px)' }}>
        <div
          className="w-full max-w-sm rounded-2xl p-6 slide-up card-glow text-center"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Student invite code"
        >
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
            <Key size={24} className="text-white" />
          </div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--foreground)' }}>Student Registered! 🎉</h2>
          <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)' }}>
            Share this 6-digit invite code with the student. They will enter it during sign-up to link their account to your roster.
          </p>

          {/* Invite code display */}
          <div
            className="rounded-2xl p-5 mb-5"
            style={{ background: 'var(--secondary)', border: '2px dashed var(--primary-light)' }}
          >
            <p className="text-xs font-600 mb-2 uppercase tracking-widest" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
              Invite Code
            </p>
            <p
              className="text-4xl font-bold tracking-[0.3em] mb-3"
              style={{ color: 'var(--primary-dark)', fontFamily: 'monospace' }}
            >
              {inviteCode}
            </p>
            <button
              onClick={handleCopy}
              className="btn-secondary flex items-center gap-2 mx-auto text-sm"
              style={{ padding: '8px 20px' }}
            >
              {copied ? <CheckCheck size={14} style={{ color: '#2E7D32' }} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>

          <div
            className="rounded-xl p-3 mb-5 text-left"
            style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)' }}
          >
            <p className="text-xs font-600 mb-1" style={{ color: '#F57F17', fontWeight: 600 }}>How the student uses this:</p>
            <ol className="text-xs space-y-1" style={{ color: 'var(--foreground)' }}>
              <li>1. Student goes to the Sign Up page</li>
              <li>2. Selects &quot;I am a Student&quot;</li>
              <li>3. Enters this code in the &quot;Mentor Invite Code&quot; field</li>
              <li>4. Their account is automatically linked to your roster</li>
            </ol>
          </div>

          <button onClick={onClose} className="btn-primary w-full">
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(45, 37, 80, 0.4)', backdropFilter: 'blur(6px)' }}>
      <div
        className="w-full max-w-md rounded-2xl p-6 slide-up card-glow overflow-y-auto"
        style={{ background: 'var(--card)', border: '1.5px solid var(--border)', maxHeight: '90vh' }}
        role="dialog"
        aria-modal="true"
        aria-label="Register new student"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Add Student</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Register a student — an invite code will be generated for them
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors" aria-label="Close modal">
            <X size={18} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label htmlFor="stuFullName" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
              Student Full Name
            </label>
            <input id="stuFullName" type="text" className="input-mystic" placeholder="e.g. Riya Chaudhary"
              {...register('fullName', { required: 'Full name is required' })}
            />
            {errors.fullName && <p className="text-xs mt-1" style={{ color: '#C62828' }}>{errors.fullName.message}</p>}
          </div>

          <div>
            <label htmlFor="stuId" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
              Student ID
            </label>
            <p className="text-xs mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Assigned by your institution (e.g. STU-2026-0013)</p>
            <input id="stuId" type="text" className="input-mystic" placeholder="STU-YYYY-XXXX"
              {...register('studentId', { required: 'Student ID is required' })}
            />
            {errors.studentId && <p className="text-xs mt-1" style={{ color: '#C62828' }}>{errors.studentId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="stuAge" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Age</label>
              <input id="stuAge" type="number" min="5" max="30" className="input-mystic" placeholder="e.g. 14"
                {...register('age', {
                  min: { value: 5, message: 'Age must be at least 5' },
                  max: { value: 30, message: 'Age must be 30 or below' },
                })}
              />
              {errors.age && <p className="text-xs mt-1" style={{ color: '#C62828' }}>{errors.age.message}</p>}
            </div>
            <div>
              <label htmlFor="stuGender" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Gender</label>
              <select id="stuGender" className="input-mystic" {...register('gender')}>
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="grade" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Grade / Year</label>
              <select id="grade" className="input-mystic" {...register('grade', { required: 'Grade is required' })}>
                <option value="">Select...</option>
                {['Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Year 1', 'Year 2', 'Year 3'].map((g) => (
                  <option key={`grade-${g}`} value={g}>{g}</option>
                ))}
              </select>
              {errors.grade && <p className="text-xs mt-1" style={{ color: '#C62828' }}>{errors.grade.message}</p>}
            </div>
            <div>
              <label htmlFor="primaryTopic" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Primary Focus</label>
              <select id="primaryTopic" className="input-mystic" {...register('primaryTopic', { required: 'Select a pillar' })}>
                <option value="">Select...</option>
                {EDUCATIONAL_PILLARS.map((t) => (
                  <option key={`topic-${t}`} value={t}>{t}</option>
                ))}
              </select>
              {errors.primaryTopic && <p className="text-xs mt-1" style={{ color: '#C62828' }}>{errors.primaryTopic.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="stuNotes" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>Initial Notes</label>
            <p className="text-xs mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Optional background context for this student</p>
            <textarea
              id="stuNotes"
              className="input-mystic resize-none"
              rows={3}
              placeholder="Any initial observations or context..."
              {...register('notes')}
            />
          </div>

          <div
            className="rounded-xl p-3"
            style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <span className="font-600" style={{ color: 'var(--primary-dark)', fontWeight: 600 }}>✨ Invite Code Flow:</span>{' '}
              After registration, a unique 6-digit code will be generated. Share it with the student so they can link their account on sign-up.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {isLoading ? (
                <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <UserPlus size={15} />
              )}
              {isLoading ? 'Registering...' : 'Register & Get Code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}