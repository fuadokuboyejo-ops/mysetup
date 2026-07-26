import { supabase } from './supabase';

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user) throw new Error('Sign in to leave feedback.');
  return data.user;
}

// Post a new piece of community feedback. Returns the created row.
export async function submitFeedback(body) {
  const user = await currentUser();
  const text = String(body || '').trim();
  if (!text) throw new Error('Write something first.');

  const { data, error } = await supabase
    .from('feedback')
    .insert({ user_id: user.id, body: text })
    .select('*')
    .single();
  if (error) throw error;
  return { id: data.id, body: data.body, createdAt: data.created_at, userId: data.user_id };
}

// Recent community feedback, newest first, hydrated with each author's name.
export async function getFeedback() {
  await currentUser();
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  const rows = data || [];
  if (!rows.length) return [];

  const userIds = [...new Set(rows.map(r => r.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', userIds);
  const byId = new Map((profiles || []).map(p => [p.id, p]));

  return rows.map(r => {
    const profile = byId.get(r.user_id);
    return {
      id: r.id,
      body: r.body,
      createdAt: r.created_at,
      userId: r.user_id,
      author: profile?.display_name || profile?.username || 'Someone',
    };
  });
}

// Delete one of the current user's feedback entries (RLS enforces ownership).
export async function deleteFeedback(id) {
  await currentUser();
  const { error } = await supabase.from('feedback').delete().eq('id', id);
  if (error) throw error;
}
