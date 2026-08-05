'use client';
import AppLayout from '@/components/AppLayout';
import CounselorDashboardContent from './components/CounselorDashboardContent';

export default function CounselorDashboardPage() {
  return (
    <AppLayout activeRoute="/counselor-dashboard">
      <CounselorDashboardContent />
    </AppLayout>
  );
}
