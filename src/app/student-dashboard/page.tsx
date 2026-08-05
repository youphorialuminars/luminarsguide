import React from 'react';
import AppLayout from '@/components/AppLayout';
import StudentDashboardContent from './components/StudentDashboardContent';
import DashboardErrorBoundary from '@/components/DashboardErrorBoundary';

export default function StudentDashboardPage() {
  return (
    <AppLayout activeRoute="/student-dashboard">
      <DashboardErrorBoundary dashboardName="Mentor Dashboard">
        <StudentDashboardContent />
      </DashboardErrorBoundary>
    </AppLayout>
  );
}