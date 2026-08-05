import AppLayout from '@/components/AppLayout';
import MentorReflectionsContent from './components/MentorReflectionsContent';

export default function MentorReflectionsPage() {
  return (
    <AppLayout activeRoute="/mentor-reflections">
      <MentorReflectionsContent />
    </AppLayout>
  );
}
