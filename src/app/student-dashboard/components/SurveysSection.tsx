'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, ClipboardList } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Survey {
  id: string;
  title: string;
  url: string;
  created_at: string;
}

export default function SurveysSection() {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSurveys = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();

    // Find the student's linked mentor_id
    // Try via user_profiles.student_id → students.mentor_id
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('student_id')
      .eq('id', user.id)
      .single();

    let mentorId: string | null = null;

    if (profile?.student_id) {
      const { data: student } = await supabase
        .from('students')
        .select('mentor_id')
        .eq('id', profile.student_id)
        .single();
      mentorId = student?.mentor_id || null;
    }

    if (!mentorId) {
      // Fallback: find by student_user_id or email
      const { data: student } = await supabase
        .from('students')
        .select('mentor_id')
        .or(`student_user_id.eq.${user.id},student_email.eq.${user.email}`)
        .limit(1)
        .maybeSingle();
      mentorId = student?.mentor_id || null;
    }

    if (!mentorId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('surveys')
      .select('id, title, url, created_at')
      .eq('mentor_id', mentorId)
      .order('created_at', { ascending: false });

    if (!error) {
      setSurveys(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  return (
    <div className="rounded-2xl p-5 card-glow" style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--accent-light)' }}
        >
          <ClipboardList size={18} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            Surveys &amp; Forms
          </h2>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Surveys shared by your mentor — click to open in a new tab
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--secondary)' }} />
          ))}
        </div>
      ) : surveys.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: 'var(--secondary)', border: '1.5px dashed var(--border)' }}
        >
          <ClipboardList size={24} className="mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            No surveys yet
          </p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Your mentor hasn&apos;t added any surveys yet. Check back later!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {surveys.map((survey, idx) => {
            const colors = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#3B82F6'];
            const color = colors[idx % colors.length];
            return (
              <a
                key={survey.id}
                href={survey.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl transition-all duration-200 hover:opacity-80 group"
                style={{
                  background: 'var(--secondary)',
                  border: '1px solid var(--border)',
                  textDecoration: 'none',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}18`, border: `1px solid ${color}40` }}
                >
                  <ClipboardList size={18} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                    {survey.title}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {survey.url}
                  </p>
                </div>
                <ExternalLink
                  size={15}
                  className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                  style={{ color: 'var(--primary)' }}
                />
              </a>
            );
          })}
        </div>
      )}

      <p className="text-xs mt-4 text-center" style={{ color: 'var(--muted-foreground)' }}>
        Survey links open in a new tab. Contact your mentor to add or update surveys.
      </p>
    </div>
  );
}
