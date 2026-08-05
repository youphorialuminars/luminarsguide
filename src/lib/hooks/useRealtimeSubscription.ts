'use client';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type TableName = 'sessions' | 'attendance' | 'meetings' | 'student_reflections';

interface SubscriptionConfig {
  table: TableName;
  filter?: string; // e.g. "student_id=eq.abc123"
  onRefresh: () => void;
}

/**
 * Subscribes to one or more Supabase tables via real-time Postgres changes.
 * Calls onRefresh whenever INSERT, UPDATE, or DELETE occurs on the table.
 * Automatically cleans up channels on unmount.
 */
export function useRealtimeSubscription(subscriptions: SubscriptionConfig[]) {
  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    if (!subscriptions.length) return;

    const supabase = createClient();
    const channels: RealtimeChannel[] = [];

    subscriptions.forEach(({ table, filter, onRefresh }) => {
      const channelName = `rt-${table}-${filter ?? 'all'}-${Math.random().toString(36).slice(2, 7)}`;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes' as any,
          {
            event: '*',
            schema: 'public',
            table,
            ...(filter ? { filter } : {}),
          },
          () => {
            onRefresh();
          }
        )
        .subscribe();

      channels.push(channel);
    });

    channelsRef.current = channels;

    return () => {
      channels.forEach((ch) => {
        supabase.removeChannel(ch);
      });
      channelsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
