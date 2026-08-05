'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

const DEMO_CREDENTIALS = [
  { label: 'Mentor', email: 'mentor@luminar.guide', password: 'LuminarGuide@2026' },
  { label: 'Counselor', email: 'counselor@luminar.guide', password: 'LuminarCounselor@2026' },
  { label: 'Student/Parent', email: 'student@luminar.guide', password: 'LuminarStudent@2026' },
  { label: 'School', email: 'school@luminar.guide', password: 'LuminarSchool@2026' },
];

function getRoleRoute(role: string): string {
  if (role === 'admin') return '/admin-portal';
  if (role === 'student_parent') return '/student-parent-dashboard';
  if (role === 'counselor') return '/counselor-dashboard';
  return '/student-dashboard';
}

export default function LoginForm({
  onSwitchToSignup,
  onForgotPassword,
}: {
  onSwitchToSignup: () => void;
  onForgotPassword: () => void;
}) {
  const router = useRouter();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    setError,
  } = useForm<LoginFormValues>({ defaultValues: { rememberMe: false } });

  const autofillDemo = (cred: typeof DEMO_CREDENTIALS[0]) => {
    setValue('email', cred.email);
    setValue('password', cred.password);
  };

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
      // Fetch role from DB to determine redirect
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        const role = profile?.role || 'mentor';
        toast.success('Welcome back!');
        router.push(getRoleRoute(role));
        router.refresh();
      }
    } catch (err: any) {
      setError('root', {
        message: err?.message || 'Invalid email or password. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
        Welcome back ✨
      </h2>
      <p className="text-sm mb-7" style={{ color: 'var(--muted-foreground)' }}>
        Sign in to your account to continue
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-600 mb-1.5"
            style={{ color: 'var(--foreground)', fontWeight: 600 }}
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            className="input-mystic"
            placeholder="your@email.com"
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Please enter a valid email address',
              },
            })}
          />
          {errors.email && (
            <p className="text-xs mt-1.5" style={{ color: '#C62828' }}>
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="loginPassword"
              className="text-sm font-600"
              style={{ color: 'var(--foreground)', fontWeight: 600 }}
            >
              Password
            </label>
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs font-500 hover:underline transition-colors"
              style={{ color: 'var(--primary)', fontWeight: 500 }}
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              id="loginPassword"
              type={showPassword ? 'text' : 'password'}
              className="input-mystic pr-10"
              placeholder="Enter your password"
              {...register('password', { required: 'Password is required' })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff size={16} style={{ color: 'var(--muted-foreground)' }} />
              ) : (
                <Eye size={16} style={{ color: 'var(--muted-foreground)' }} />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs mt-1.5" style={{ color: '#C62828' }}>
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Root error */}
        {errors.root && (
          <div
            className="px-4 py-3 rounded-xl text-sm"
            style={{ background: '#FDECEA', color: '#C62828', border: '1px solid #FFCDD2' }}
          >
            {errors.root.message}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full flex items-center justify-center gap-2"
          style={{ height: '44px' }}
        >
          {isLoading ? (
            <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <>
              <LogIn size={16} />
              Sign In
            </>
          )}
        </button>
      </form>

      {/* Demo credentials */}
      <div
        className="mt-6 p-4 rounded-xl"
        style={{ background: 'var(--secondary)', border: '1.5px solid var(--border)' }}
      >
        <p className="text-xs font-600 mb-3" style={{ color: 'var(--primary-dark)', fontWeight: 600 }}>
          Demo Credentials
        </p>
        <div className="flex flex-col gap-2">
          {DEMO_CREDENTIALS.map((cred) => (
            <div key={cred.label} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span
                  className="text-xs font-600 px-2 py-0.5 rounded-full mr-2"
                  style={{ background: 'var(--accent-light)', color: 'var(--primary-dark)', fontWeight: 600 }}
                >
                  {cred.label}
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
                  {cred.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => autofillDemo(cred)}
                className="text-xs font-600 px-3 py-1 rounded-lg transition-colors hover:opacity-80 flex-shrink-0"
                style={{ background: 'var(--primary)', color: 'white', fontWeight: 600 }}
              >
                Use
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}