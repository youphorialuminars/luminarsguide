import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppLayout from '@/components/AppLayout';
import StudentParentDashboardContent from './components/StudentParentDashboardContent';
import DashboardErrorBoundary from '@/components/DashboardErrorBoundary';

export default async function StudentParentDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase?.auth?.getUser();

  if (!user) {
    redirect('/sign-up-login-screen');
  }

  const { data: profile } = await supabase?.from('user_profiles')?.select('role')?.eq('id', user?.id)?.single();

  if (profile?.role !== 'student_parent') {
    redirect('/student-dashboard');
  }

  return (
    <AppLayout activeRoute="/student-parent-dashboard">
      <DashboardErrorBoundary dashboardName="Student/Parent Dashboard">
        <StudentParentDashboardContent />
      </DashboardErrorBoundary>
    </AppLayout>
  );
}
