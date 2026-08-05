'use client';
import React, { useState } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface DeleteStudentModalProps {
  studentId: string;
  studentName: string;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteStudentModal({ studentId, studentName, onClose, onDeleted }: DeleteStudentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      // Sessions and meetings cascade-delete automatically via FK ON DELETE CASCADE
      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }
      onDeleted();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to delete student.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(45, 37, 80, 0.5)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 slide-up"
        style={{ background: 'var(--card)', border: '1.5px solid #FFCDD2' }}
        role="dialog"
        aria-modal="true"
        aria-label="Delete student confirmation"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FDECEA' }}>
              <AlertTriangle size={20} style={{ color: '#C62828' }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>Delete Student</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X size={16} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="rounded-xl p-4 mb-5" style={{ background: '#FFF8F8', border: '1px solid #FFCDD2' }}>
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>
            Are you sure you want to delete{' '}
            <span className="font-bold" style={{ color: '#C62828' }}>{studentName}</span>
            {' '}and all their history?
          </p>
          <ul className="mt-3 space-y-1">
            {['All AI session analyses', 'All session scores and observations', 'All scheduled meetings and calendar events'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs" style={{ color: '#C62828' }}>
                <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#C62828' }} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2 mb-4 text-xs" style={{ background: '#FDECEA', color: '#C62828', border: '1px solid #FFCDD2' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 transition-all duration-150"
            style={{
              background: loading ? '#FFCDD2' : '#C62828',
              color: 'white',
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <Trash2 size={15} />
            )}
            {loading ? 'Deleting...' : 'Yes, Delete Student'}
          </button>
        </div>
      </div>
    </div>
  );
}
