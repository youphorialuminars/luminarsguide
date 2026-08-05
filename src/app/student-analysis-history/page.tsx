import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import AnalysisHistoryContent from './components/AnalysisHistoryContent';

function AnalysisHistoryFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lavender-600">Loading...</div>
    </div>
  );
}

export default function StudentAnalysisHistoryPage() {
  return (
    <AppLayout activeRoute="/student-analysis-history">
      <Suspense fallback={<AnalysisHistoryFallback />}>
        <AnalysisHistoryContent />
      </Suspense>
    </AppLayout>
  );
}