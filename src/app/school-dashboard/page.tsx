import AppLayout from '@/components/AppLayout';
import SchoolDashboardContent from './components/SchoolDashboardContent';

export default function SchoolDashboardPage() {
  return (
    <AppLayout activeRoute="/school-dashboard">
      <SchoolDashboardContent />
    </AppLayout>
  );
}
