'use client';
import { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import CounselorStudentViewContent from './components/CounselorStudentViewContent';

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
    </div>
  );
}

export default function CounselorStudentViewPage() {
  return (
    <AppLayout activeRoute="/counselor-dashboard">
      <Suspense fallback={<LoadingFallback />}>
        <CounselorStudentViewContent />
      </Suspense>
    </AppLayout>
  );
}
