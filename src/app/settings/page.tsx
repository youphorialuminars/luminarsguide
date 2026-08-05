'use client';
import React, { useState, useEffect } from 'react';
import { Settings, Type, Check, Link2, RefreshCw, Mail, UserCheck, Copy, CheckCheck } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type FontSize = 'small' | 'medium' | 'large';

const FONT_SIZE_KEY = 'luminar_font_size';

const FONT_OPTIONS: { value: FontSize; label: string; description: string; rootSize: string }[] = [
  {
    value: 'small',
    label: 'Small',
    description: 'Compact text for more content on screen',
    rootSize: '13px',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Default balanced size for everyday use',
    rootSize: '14px',
  },
  {
    value: 'large',
    label: 'Large',
    description: 'Larger text for improved accessibility',
    rootSize: '16px',
  },
];

export function applyFontSize(size: FontSize) {
  const option = FONT_OPTIONS.find((o) => o.value === size);
  if (!option) return;
  document.documentElement.style.setProperty('--app-font-size', option.rootSize);
  document.documentElement.style.fontSize = option.rootSize;
}

export default function SettingsPage() {
  const { user, userRole } = useAuth();
  const [fontSize, setFontSize] = useState<FontSize>('medium');

  // Mentor code state
  const [mentorCode, setMentorCode] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Link by email (mentor)
  const [studentEmail, setStudentEmail] = useState('');
  const [linkingEmail, setLinkingEmail] = useState(false);

  // Link by code (student)
  const [mentorCodeInput, setMentorCodeInput] = useState('');
  const [linkingCode, setLinkingCode] = useState(false);
  const [linkedMentorName, setLinkedMentorName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FONT_SIZE_KEY) as FontSize | null;
      if (saved && ['small', 'medium', 'large'].includes(saved)) {
        setFontSize(saved);
        applyFontSize(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchProfile();
  }, [user, userRole]);

  const fetchProfile = async () => {
    if (!user) return;
    setLoadingCode(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('user_profiles')
        .select('mentor_code, mentor_id, full_name')
        .eq('id', user.id)
        .single();

      if (data) {
        if (userRole === 'mentor') {
          setMentorCode(data.mentor_code || null);
        }
        if (userRole === 'student_parent' && data.mentor_id) {
          // Fetch mentor name
          const { data: mentorData } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', data.mentor_id)
            .single();
          setLinkedMentorName(mentorData?.full_name || 'Your Mentor');
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingCode(false);
    }
  };

  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size);
    applyFontSize(size);
    try {
      localStorage.setItem(FONT_SIZE_KEY, size);
    } catch {
      // ignore
    }
  };

  const handleCopyCode = async () => {
    if (!mentorCode) return;
    try {
      await navigator.clipboard.writeText(mentorCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Mentor code copied!');
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const handleRegenerateCode = async () => {
    setRegenerating(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('regenerate_mentor_code');
      if (error) throw error;
      setMentorCode(data as string);
      toast.success('New mentor code generated!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to regenerate code');
    } finally {
      setRegenerating(false);
    }
  };

  const handleLinkByEmail = async () => {
    if (!studentEmail.trim()) {
      toast.error('Please enter a student email address');
      return;
    }
    setLinkingEmail(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('mentor_link_student_by_email', {
        p_student_email: studentEmail.trim().toLowerCase(),
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast.error(result.error || 'Failed to link student');
      } else {
        toast.success(`Student linked successfully!`);
        setStudentEmail('');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to link student');
    } finally {
      setLinkingEmail(false);
    }
  };

  const handleLinkByCode = async () => {
    const code = mentorCodeInput.trim().toUpperCase();
    if (!code || code.length < 6) {
      toast.error('Please enter a valid mentor code');
      return;
    }
    setLinkingCode(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('link_student_to_mentor_by_code', {
        p_mentor_code: code,
        p_student_name: user?.user_metadata?.full_name || '',
        p_grade: '',
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast.error(result.error || 'Invalid mentor code');
      } else {
        toast.success('Successfully linked to your mentor!');
        setMentorCodeInput('');
        fetchProfile();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to link mentor code');
    } finally {
      setLinkingCode(false);
    }
  };

  return (
    <AppLayout activeRoute="/settings">
      <div className="fade-in max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center">
              <Settings size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              Settings
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Customize your Luminar's Guide experience
          </p>
        </div>

        {/* ── Mentor Code Card (Mentor only) ── */}
        {userRole === 'mentor' && (
          <div
            className="rounded-2xl p-6 card-glow mb-6"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--secondary)' }}
              >
                <Link2 size={18} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                  Your Mentor Code
                </h2>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Share this code with students so they can link to you during sign-up or in their settings
                </p>
              </div>
            </div>

            {loadingCode ? (
              <div className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--secondary)' }} />
            ) : (
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="flex-1 px-4 py-3 rounded-xl font-mono text-xl font-bold tracking-widest text-center"
                  style={{ background: 'var(--secondary)', color: 'var(--primary-dark)', border: '1.5px solid var(--border)', letterSpacing: '0.2em' }}
                >
                  {mentorCode || '—'}
                </div>
                <button
                  onClick={handleCopyCode}
                  disabled={!mentorCode}
                  className="p-3 rounded-xl transition-colors"
                  style={{ background: 'var(--secondary)', border: '1.5px solid var(--border)' }}
                  title="Copy code"
                >
                  {copied ? <CheckCheck size={18} style={{ color: '#2E7D32' }} /> : <Copy size={18} style={{ color: 'var(--primary)' }} />}
                </button>
                <button
                  onClick={handleRegenerateCode}
                  disabled={regenerating}
                  className="p-3 rounded-xl transition-colors"
                  style={{ background: 'var(--secondary)', border: '1.5px solid var(--border)' }}
                  title="Generate new code"
                >
                  <RefreshCw size={18} style={{ color: 'var(--muted-foreground)', animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
                </button>
              </div>
            )}

            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              ⚠️ Regenerating your code will invalidate the old one. Students with the old code will need to re-link.
            </p>

            {/* Link student by email */}
            <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Mail size={15} style={{ color: 'var(--primary)' }} />
                <p className="text-sm font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                  Link Student by Email
                </p>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
                Enter a student's registered email to link them to your roster directly.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  className="input-mystic flex-1"
                  placeholder="student@example.com"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLinkByEmail()}
                />
                <button
                  onClick={handleLinkByEmail}
                  disabled={linkingEmail || !studentEmail.trim()}
                  className="btn-primary flex items-center gap-2 px-4"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {linkingEmail ? (
                    <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                  ) : (
                    <><UserCheck size={15} />Link</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Mentor Code Entry (Student/Parent only) ── */}
        {userRole === 'student_parent' && (
          <div
            className="rounded-2xl p-6 card-glow mb-6"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--secondary)' }}
              >
                <Link2 size={18} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                  Link to Your Mentor
                </h2>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Enter the 8-character code provided by your mentor to connect your account
                </p>
              </div>
            </div>

            {linkedMentorName ? (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4"
                style={{ background: '#E8F5E9', border: '1.5px solid #A5D6A7' }}
              >
                <UserCheck size={18} style={{ color: '#2E7D32' }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: '#2E7D32', fontWeight: 700 }}>
                    Linked to {linkedMentorName}
                  </p>
                  <p className="text-xs" style={{ color: '#388E3C' }}>
                    Your account is connected. Enter a new code below to switch mentors.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex gap-2">
              <input
                type="text"
                className="input-mystic flex-1 uppercase"
                placeholder="e.g. AB12CD34"
                maxLength={8}
                value={mentorCodeInput}
                onChange={(e) => setMentorCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLinkByCode()}
              />
              <button
                onClick={handleLinkByCode}
                disabled={linkingCode || mentorCodeInput.trim().length < 6}
                className="btn-primary flex items-center gap-2 px-4"
                style={{ whiteSpace: 'nowrap' }}
              >
                {linkingCode ? (
                  <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                ) : (
                  <><Link2 size={15} />Link</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Font Size Card */}
        <div
          className="rounded-2xl p-6 card-glow mb-6"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--secondary)' }}
            >
              <Type size={18} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                Font Size
              </h2>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Adjust text size across all pages for better readability
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5">
            {FONT_OPTIONS.map((option) => {
              const isSelected = fontSize === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleFontSizeChange(option.value)}
                  className="relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-200"
                  style={{
                    background: isSelected ? 'var(--secondary)' : 'var(--muted)',
                    border: isSelected ? '2px solid var(--primary)' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                  aria-pressed={isSelected}
                  aria-label={`Set font size to ${option.label}`}
                >
                  {isSelected && (
                    <span
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--primary)' }}
                    >
                      <Check size={11} className="text-white" />
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: option.rootSize,
                      fontWeight: 700,
                      color: isSelected ? 'var(--primary-dark)' : 'var(--foreground)',
                      lineHeight: 1,
                    }}
                  >
                    Aa
                  </span>
                  <span
                    className="font-bold"
                    style={{
                      fontSize: '13px',
                      color: isSelected ? 'var(--primary-dark)' : 'var(--foreground)',
                      fontWeight: 600,
                    }}
                  >
                    {option.label}
                  </span>
                  <span
                    className="text-center leading-tight"
                    style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}
                  >
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className="mt-4 px-4 py-3 rounded-xl"
            style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <strong style={{ color: 'var(--foreground)' }}>Current:</strong>{' '}
              {FONT_OPTIONS.find((o) => o.value === fontSize)?.label} —{' '}
              {FONT_OPTIONS.find((o) => o.value === fontSize)?.description}. Changes apply instantly across all pages.
            </p>
          </div>
        </div>

        {/* Placeholder for future settings */}
        <div
          className="rounded-2xl p-6"
          style={{ background: 'var(--card)', border: '1.5px solid var(--border)', opacity: 0.6 }}
        >
          <p className="text-sm font-600" style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>
            More settings coming soon
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Theme customization, notification preferences, and export options will be available in a future update.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
