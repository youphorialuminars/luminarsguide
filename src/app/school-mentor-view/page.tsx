import { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import SchoolMentorViewContent from './components/SchoolMentorViewContent';

export default function SchoolMentorViewPage() {
  return (
    <AppLayout activeRoute="/school-dashboard">
      <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 rounded-full border-4" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>}>
        <SchoolMentorViewContent />
      </Suspense>
    </AppLayout>
  );
}
