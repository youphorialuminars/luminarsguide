'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface ResetValues {
  email: string;
}

export default function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const { resetPassword } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, setError } = useForm<ResetValues>();

  const onSubmit = async (data: ResetValues) => {
    setIsLoading(true);
    try {
      await resetPassword(data.email);
      setStep(2);
      toast.success('Password reset email sent!');
    } catch (err: any) {
      setError('email', {
        message: err?.message || 'Failed to send reset email. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft size={15} />
        Back to Sign In
      </button>

      {step === 1 && (
        <>
          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
            Reset Password 🔑
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
            Enter your email address and we&apos;ll send you a reset link
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div>
              <label
                htmlFor="resetEmail"
                className="block text-sm font-600 mb-1.5"
                style={{ color: 'var(--foreground)', fontWeight: 600 }}
              >
                Email Address
              </label>
              <input
                id="resetEmail"
                type="email"
                className="input-mystic"
                placeholder="mentor@example.com"
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Please enter a valid email address' },
                })}
              />
              {errors.email && (
                <p className="text-xs mt-1.5" style={{ color: '#C62828' }}>
                  {errors.email.message}
                </p>
              )}
            </div>
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
                  <KeyRound size={16} />
                  Send Reset Link
                </>
              )}
            </button>
          </form>
        </>
      )}

      {step === 2 && (
        <div className="text-center fade-in">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: '#E8F5E9' }}
          >
            <CheckCircle2 size={32} style={{ color: '#2E7D32' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
            Check Your Email ✨
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
            We&apos;ve sent a password reset link to your email address. Click the link to set a new password.
          </p>
          <button type="button" onClick={onBack} className="btn-primary w-full">
            Back to Sign In
          </button>
        </div>
      )}
    </div>
  );
}