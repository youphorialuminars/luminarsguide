'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, Trash2, RefreshCw, ExternalLink, Link } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Survey {
  id: string;
  title: string;
  url: string;
  created_at: string;
}

export default function ManageSurveys() {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSurveys = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('surveys')
      .select('id, title, url, created_at')
      .eq('mentor_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load surveys');
    } else {
      setSurveys(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  const handleAdd = async () => {
    if (!title.trim()) {
      toast.error('Please enter a survey title');
      return;
    }
    if (!url.trim()) {
      toast.error('Please enter a survey URL');
      return;
    }
    // Basic URL validation
    try {
      new URL(url.trim());
    } catch {
      toast.error('Please enter a valid URL (e.g. https://forms.google.com/...)');
      return;
    }
    if (!user) return;
    setAdding(true);
    const supabase = createClient();
    const { error } = await supabase.from('surveys').insert({
      mentor_id: user.id,
      title: title.trim(),
      url: url.trim(),
    });
    if (error) {
      toast.error(error.message || 'Failed to add survey');
    } else {
      toast.success('Survey added! Students can now see it.');
      setTitle('');
      setUrl('');
      fetchSurveys();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const supabase = createClient();
    const { error } = await supabase.from('surveys').delete().eq('id', id);
    if (error) {
      toast.error(error.message || 'Failed to delete survey');
    } else {
      toast.success('Survey removed');
      setSurveys((prev) => prev.filter((s) => s.id !== id));
    }
    setDeletingId(null);
  };

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
            Manage Surveys
          </h2>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Add survey links for your students — they see these as read-only clickable links
          </p>
        </div>
      </div>

      {/* Add form */}
      <div
        className="rounded-xl p-4 mb-5 space-y-3"
        style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
      >
        <p className="text-xs font-bold" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
          Add New Survey
        </p>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            className="input-mystic"
            placeholder="Survey title (e.g. End of Month Feedback)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex items-center gap-2">
            <Link size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <input
              type="url"
              className="input-mystic flex-1"
              placeholder="https://forms.google.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !title.trim() || !url.trim()}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {adding ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Plus size={14} />
          )}
          {adding ? 'Adding...' : 'Add Survey'}
        </button>
      </div>

      {/* Survey list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--secondary)' }} />
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
            Add your first survey above. Students will see it on their dashboard.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {surveys.map((survey) => (
            <div
              key={survey.id}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--accent-light)' }}
              >
                <ClipboardList size={14} style={{ color: 'var(--primary)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
                  {survey.title}
                </p>
                <a
                  href={survey.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs truncate flex items-center gap-1 hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--primary)' }}
                >
                  <ExternalLink size={10} />
                  {survey.url}
                </a>
              </div>
              <button
                onClick={() => handleDelete(survey.id)}
                disabled={deletingId === survey.id}
                className="flex-shrink-0 p-2 rounded-lg transition-colors hover:opacity-70"
                style={{ background: '#FDECEA', color: '#C62828', border: '1px solid #FFCDD2' }}
                title="Delete survey"
              >
                {deletingId === survey.id ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
