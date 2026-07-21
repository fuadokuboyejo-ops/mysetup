import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { stripDataUrl } from './media';

const PROFILE_MEDIA_BUCKET = 'profile-media';

function publicUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from(PROFILE_MEDIA_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

export async function getProfileMedia(user) {
  const userId = user?.id;
  if (!userId) return {};

  const { data, error } = await supabase
    .from('profiles')
    .select('username, display_name, bio, account_private, avatar_path, banner_path')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;

  return {
    username: data?.username || null,
    displayName: data?.display_name || null,
    bio: data?.bio || '',
    isPrivate: !!data?.account_private,
    avatarUrl: publicUrl(data?.avatar_path),
    bannerUrl: publicUrl(data?.banner_path),
  };
}

export async function saveProfileImage(user, kind, base64) {
  if (!['avatar', 'banner'].includes(kind)) throw new Error('Unsupported profile image type.');
  if (!base64) throw new Error('The selected image could not be read.');

  const userId = user?.id;
  if (!userId) throw new Error('Sign in to update your profile.');

  const path = `${userId}/${kind}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_MEDIA_BUCKET)
    .upload(path, decode(stripDataUrl(base64)), {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const column = kind === 'avatar' ? 'avatar_path' : 'banner_path';
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ [column]: path, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (profileError) throw profileError;

  const url = publicUrl(path);
  const current = await getProfileMedia(user);
  return {
    ...current,
    [`${kind}Url`]: url ? `${url}?v=${Date.now()}` : null,
  };
}
