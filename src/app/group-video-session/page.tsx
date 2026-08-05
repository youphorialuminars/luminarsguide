import React from 'react';
import AppLayout from '@/components/AppLayout';
import GroupVideoSessionContent from './components/GroupVideoSessionContent';

export default function GroupVideoSessionPage() {
  return (
    <AppLayout activeRoute="/group-video-session">
      <GroupVideoSessionContent />
    </AppLayout>
  );
}
