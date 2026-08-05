'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, UserPlus, GraduationCap, BookOpen, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';


type RoleType = 'mentor' | 'student_parent' | 'counselor' | 'school';

interface SignUpValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  inviteCode: string;
  counselorInviteCode: string;
  schoolInviteCode: string;
  agreeTerms: boolean;
}

export default function SignUpForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const router = useRouter();
  const { signUp } = useAuth();
  const [selectedRole, setSelectedRole] = useState<RoleType>('mentor');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<SignUpValues>();

  const passwordVal = watch('password');

  const onSubmit = async (data: SignUpValues) => {
    setIsLoading(true);
    try {
      const authData = await signUp(data.email, data.password, {
        fullName: data.fullName,
        role: selectedRole,
      });

      // Student with mentor invite code
      if (selectedRole === 'student_parent' && data.inviteCode?.trim() && authData?.user) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const supabase = createClient();
          const { data: rpcData, error: rpcError } = await supabase.rpc('student_use_invite_code', {
            p_invite_code: data.inviteCode.trim().toUpperCase(),
          });
          if (rpcError || !rpcData?.success) {
            toast.warning(rpcData?.error || 'Account created but invite code could not be applied. You can link later from your dashboard.');
          } else {
            toast.success("Account created and linked to your mentor's roster! 🎉");
          }
        } catch {
          toast.warning('Account created. You can enter your invite code later from your dashboard.');
        }
      }

      // Mentor with counselor invite code
      if (selectedRole === 'mentor' && data.counselorInviteCode?.trim() && authData?.user) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const supabase = createClient();
          const { data: rpcData, error: rpcError } = await supabase.rpc('mentor_use_counselor_invite', {
            p_invite_code: data.counselorInviteCode.trim().toUpperCase(),
          });
          if (rpcError || !(rpcData as any)?.success) {
            toast.warning((rpcData as any)?.error || 'Account created but counselor code could not be applied. Contact your counselor.');
          } else {
            toast.success("Account created and linked to your counselor! 🎉");
          }
        } catch {
          toast.warning('Account created. You can link to a counselor later.');
        }
      }

      // Student or Mentor with school invite code
      const hasSchoolCode =
        (selectedRole === 'student_parent' || selectedRole === 'mentor') &&
        data.schoolInviteCode?.trim() &&
        authData?.user;
      if (hasSchoolCode) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          const supabase = createClient();
          const { data: rpcData, error: rpcError } = await supabase.rpc('use_school_invite_code', {
            p_invite_code: data.schoolInviteCode!.trim().toUpperCase(),
          });
          if (rpcError || !(rpcData as any)?.success) {
            toast.warning((rpcData as any)?.error || 'Account created but school code could not be applied. You can link later.');
          } else {
            toast.success('Linked to your school! 🏫');
          }
        } catch {
          toast.warning('Account created. You can link to a school later.');
        }
      }

      if (selectedRole === 'school') {
        toast.success("School account created! Welcome to Luminar's Guide. 🏫");
        router.push('/school-dashboard');
      } else if (selectedRole === 'student_parent') {
        toast.success("Account created! Welcome to Luminar's Guide. 🌟");
        router.push('/student-parent-dashboard');
      } else if (selectedRole === 'counselor') {
        toast.success("Counselor account created! Welcome to Luminar's Guide. 🌟");
        router.push('/counselor-dashboard');
      } else {
        toast.success("Account created! Welcome to Luminar's Guide. 🌟");
        router.push('/student-dashboard');
      }
      router.refresh();
    } catch (err: any) {
      setError('root', {
        message: err?.message || 'Failed to create account. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
        Create Your Account 🌟
      </h2>
      <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)' }}>
        Join Luminar&apos;s Guide — choose your role to get started
      </p>

      {/* Role Selector — 4 options in 2x2 grid */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {([
          { role: 'mentor', label: 'Mentor', Icon: BookOpen },
          { role: 'student_parent', label: 'Student', Icon: GraduationCap },
          { role: 'counselor', label: 'Counselor', Icon: UserPlus },
          { role: 'school', label: 'School', Icon: Building2 },
        ] as const).map(({ role, label, Icon }) => (
          <button
            key={role}
            type="button"
            onClick={() => setSelectedRole(role)}
            className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200"
            style={{
              background: selectedRole === role ? 'var(--secondary)' : 'var(--muted)',
              borderColor: selectedRole === role ? 'var(--primary)' : 'var(--border)',
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: selectedRole === role ? 'var(--primary)' : 'var(--border)' }}
            >
              <Icon size={16} className="text-white" />
            </div>
            <p className="text-xs font-bold" style={{ color: selectedRole === role ? 'var(--primary-dark)' : 'var(--foreground)', fontWeight: 700 }}>
              {label}
            </p>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
            {selectedRole === 'school' ? 'School / Institution Name' : 'Full Name'}
          </label>
          <input
            id="fullName"
            type="text"
            className="input-mystic"
            placeholder={
              selectedRole === 'school' ? 'e.g. Sunrise International School'
              : selectedRole === 'counselor' ? 'Dr. Priya Sharma'
              : selectedRole === 'mentor'? 'Dr. Ananya Krishnan' :'Riya Chaudhary'
            }
            {...register('fullName', { required: 'This field is required', minLength: { value: 3, message: 'Must be at least 3 characters' } })}
          />
          {errors.fullName && <p className="text-xs mt-1.5" style={{ color: '#C62828' }}>{errors.fullName.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="signupEmail" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
            Email Address
          </label>
          <input
            id="signupEmail"
            type="email"
            className="input-mystic"
            placeholder={
              selectedRole === 'school' ? 'admin@school.edu'
              : selectedRole === 'counselor' ? 'counselor@example.com'
              : selectedRole === 'mentor'? 'mentor@example.com' :'student@example.com'
            }
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Please enter a valid email address' },
            })}
          />
          {errors.email && <p className="text-xs mt-1.5" style={{ color: '#C62828' }}>{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="signupPassword" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
            Password
          </label>
          <div className="relative">
            <input
              id="signupPassword"
              type={showPassword ? 'text' : 'password'}
              className="input-mystic pr-10"
              placeholder="Create a strong password"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Minimum 8 characters' },
                pattern: { value: /(?=.*[A-Z])(?=.*[0-9])/, message: 'Must include at least one uppercase letter and one number' },
              })}
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Toggle password visibility">
              {showPassword ? <EyeOff size={16} style={{ color: 'var(--muted-foreground)' }} /> : <Eye size={16} style={{ color: 'var(--muted-foreground)' }} />}
            </button>
          </div>
          {errors.password && <p className="text-xs mt-1.5" style={{ color: '#C62828' }}>{errors.password.message}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              className="input-mystic pr-10"
              placeholder="Re-enter your password"
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (v) => v === passwordVal || 'Passwords do not match',
              })}
            />
            <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Toggle confirm password visibility">
              {showConfirm ? <EyeOff size={16} style={{ color: 'var(--muted-foreground)' }} /> : <Eye size={16} style={{ color: 'var(--muted-foreground)' }} />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs mt-1.5" style={{ color: '#C62828' }}>{errors.confirmPassword.message}</p>}
        </div>

        {/* Mentor Invite Code (only for student/parent) */}
        {selectedRole === 'student_parent' && (
          <div>
            <label htmlFor="inviteCode" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
              Mentor Invite Code{' '}
              <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>(optional)</span>
            </label>
            <input
              id="inviteCode"
              type="text"
              className="input-mystic uppercase tracking-widest"
              placeholder="e.g. AB12CD34"
              maxLength={8}
              {...register('inviteCode')}
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
              Enter the 8-character code your mentor gave you to link your account.
            </p>
          </div>
        )}

        {/* Counselor Invite Code (only for mentors) */}
        {selectedRole === 'mentor' && (
          <div>
            <label htmlFor="counselorInviteCode" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
              Counselor Invite Code{' '}
              <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>(optional)</span>
            </label>
            <input
              id="counselorInviteCode"
              type="text"
              className="input-mystic uppercase tracking-widest"
              placeholder="e.g. C-AB12CD"
              maxLength={8}
              {...register('counselorInviteCode')}
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
              If a Counselor supervises you, enter their invite code to link your account.
            </p>
          </div>
        )}

        {/* School Invite Code (for students and mentors) */}
        {(selectedRole === 'student_parent' || selectedRole === 'mentor') && (
          <div>
            <label htmlFor="schoolInviteCode" className="block text-sm font-600 mb-1.5" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
              School Invite Code{' '}
              <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>(optional)</span>
            </label>
            <input
              id="schoolInviteCode"
              type="text"
              className="input-mystic uppercase tracking-widest"
              placeholder="e.g. S-AB12CD"
              maxLength={8}
              {...register('schoolInviteCode')}
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
              Enter the school code (S-XXXXXX) provided by your institution to link your account.
            </p>
          </div>
        )}

        {/* Agree terms */}
        <div className="flex items-start gap-2">
          <input
            id="agreeTerms"
            type="checkbox"
            className="w-4 h-4 mt-0.5 accent-primary cursor-pointer flex-shrink-0"
            {...register('agreeTerms', { required: 'You must agree to the terms' })}
          />
          <label htmlFor="agreeTerms" className="text-xs cursor-pointer leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            I agree to the{' '}
            <span className="font-600 hover:underline cursor-pointer" style={{ color: 'var(--primary)', fontWeight: 600 }}>Terms of Service</span>
            {' '}and{' '}
            <span className="font-600 hover:underline cursor-pointer" style={{ color: 'var(--primary)', fontWeight: 600 }}>Privacy Policy</span>
          </label>
        </div>
        {errors.agreeTerms && <p className="text-xs -mt-2" style={{ color: '#C62828' }}>{errors.agreeTerms.message}</p>}

        {/* Root error */}
        {errors.root && (
          <div
            className="px-4 py-3 rounded-xl text-sm"
            style={{ background: '#FDECEA', color: '#C62828', border: '1px solid #FFCDD2' }}
          >
            {errors.root.message}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full flex items-center justify-center gap-2"
          style={{ height: '48px' }}
        >
          {isLoading ? (
            <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <UserPlus size={16} />
          )}
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </button>

        <p className="text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-600 hover:underline"
            style={{ color: 'var(--primary)', fontWeight: 600 }}
          >
            Sign in
          </button>
        </p>
      </form>
    </div>
  );
}