'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MentorStudentChat from '@/components/MentorStudentChat';

interface ChatStudent {
  id: string;
  name: string;
  student_user_id: string | null;
}

export default function MentorChatList() {
  const { user } = useAuth();
  const supabase = createClient();
  const [students, setStudents] = useState<ChatStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('students')
        .select('id, name, student_user_id')
        .eq('mentor_id', user.id)
        .not('student_user_id', 'is', null)
        .order('name', { ascending: true });
      setStudents(data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ color: 'var(--primary)' }} />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ color: 'var(--primary)' }} />
        </svg>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--secondary)' }}>
          <MessageSquare size={24} style={{ color: 'var(--primary)' }} />
        </div>
        <h3 className="font-bold text-base" style={{ color: 'var(--foreground)' }}>No students to chat with yet</h3>
        <p className="text-sm text-center max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
          Students need to sign up and link their account to your mentor code before you can chat with them.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <MessageSquare size={20} style={{ color: 'var(--primary)' }} />
        <div>
          <h2 className="text-base font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
            Student Chat
          </h2>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Direct messaging with your linked students
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }} />
        <input
          type="text"
          className="input-mystic pl-9"
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Student list */}
      <div className="flex flex-col gap-3">
        {filtered.map((student) => (
          <div
            key={student.id}
            className="flex items-center justify-between p-4 rounded-2xl"
            style={{ background: 'var(--card)', border: '1.5px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
                style={{ background: 'var(--gradient-primary)' }}
              >
                {student.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                  {student.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Linked student
                </p>
              </div>
            </div>
            {student.student_user_id && (
              <MentorStudentChat
                recipientId={student.student_user_id}
                recipientName={student.name}
                studentId={student.id}
              />
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
            No students match your search.
          </p>
        )}
      </div>
    </div>
  );
}
