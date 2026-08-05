import React from 'react';
import AppLayout from '@/components/AppLayout';
import NewSessionContent from './components/NewSessionContent';

export default function NewSessionPage() {
  return (
    <AppLayout activeRoute="/new-session">
      <NewSessionContent />
    </AppLayout>
  );
}