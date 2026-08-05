import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppLayout from '@/components/AppLayout';
import AdminPortalContent from './components/AdminPortalContent';
import DashboardErrorBoundary from '@/components/DashboardErrorBoundary';

export default async function AdminPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase?.auth?.getUser();

  if (!user) {
    redirect('/sign-up-login-screen');
  }

  const { data: profile } = await supabase?.from('user_profiles')?.select('role')?.eq('id', user?.id)?.single();

  if (profile?.role !== 'admin') {
    redirect('/student-dashboard');
  }

  return (
    <AppLayout activeRoute="/admin-portal">
      <DashboardErrorBoundary dashboardName="Admin Portal">
        <AdminPortalContent />
      </DashboardErrorBoundary>
    </AppLayout>
  );
}
