import { supabase } from './supabase';

export interface AppNotification {
  id: string;
  type: string;
  artworkId: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

function rowToNotification(row: any): AppNotification {
  return {
    id: row.id,
    type: row.type,
    artworkId: row.artwork_id,
    message: row.message,
    read: row.read,
    createdAt: row.created_at,
  };
}

// RLS already scopes this to the caller's own notifications — no need to
// filter by user id client-side.
export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !data) return [];
  return data.map(rowToNotification);
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read', false);

  if (error || count === null) return 0;
  return count;
}

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  return { error: error?.message || null };
}

export async function markAllNotificationsRead(): Promise<{ error: string | null }> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false);
  return { error: error?.message || null };
}
