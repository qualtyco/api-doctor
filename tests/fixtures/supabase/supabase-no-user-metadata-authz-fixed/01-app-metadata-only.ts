import type { User } from '@supabase/supabase-js';

type UserRole = 'student' | 'sponsor';

export function getUserRole(user: User | null): UserRole {
  if (!user) return 'student';
  const role = user.app_metadata?.role;
  return role === 'sponsor' ? 'sponsor' : 'student';
}
