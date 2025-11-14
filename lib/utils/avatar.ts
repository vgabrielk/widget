export const AVATAR_BUCKET = 'avatars';
export const DEFAULT_AVATAR = '/default-avatar.png';
const PUBLIC_STORAGE_PREFIX = '/storage/v1/object/public/';

export const getAvatarCacheKey = (path: string) => `avatar-cache-${path}`;

export function normalizeAvatarPath(value?: string | null): string | null {
  if (!value) return null;

  let path = value.trim();
  if (!path) return null;

  // Remove query/hash params
  path = path.split('?')[0]?.split('#')[0] || path;

  // Remove known prefixes
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const fullPrefix = `${supabaseUrl}${PUBLIC_STORAGE_PREFIX}${AVATAR_BUCKET}/`;
    if (path.startsWith(fullPrefix)) {
      path = path.slice(fullPrefix.length);
    }
  }

  if (path.startsWith(PUBLIC_STORAGE_PREFIX)) {
    path = path.slice((PUBLIC_STORAGE_PREFIX + AVATAR_BUCKET + '/').length);
  }

  if (path.startsWith(`/${AVATAR_BUCKET}/`)) {
    path = path.slice((`/${AVATAR_BUCKET}/`).length);
  }

  if (path.startsWith(`${AVATAR_BUCKET}/`)) {
    path = path.slice((`${AVATAR_BUCKET}/`).length);
  }

  if (path.startsWith('/')) {
    path = path.slice(1);
  }

  // Handles dashboard routes that embed avatar filenames in the URL,
  // e.g. /dashboard/widgets/123/avatar-456.png. We only strip the
  // dashboard prefix while preserving any user-folder segments.
  const dashboardMatch = path.match(
    /dashboard\/.+\/(avatar-[\w.-]+\.(png|jpg|jpeg|webp|gif))/i
  );
  if (dashboardMatch) {
    path = dashboardMatch[1];
  }

  return path || null;
}

export function isSameAvatarPath(a?: string | null, b?: string | null) {
  return normalizeAvatarPath(a) === normalizeAvatarPath(b);
}

