import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UserProvider } from '@/lib/contexts/user-context';
import { getUserProfile } from '@/lib/auth/session';

export default async function SaaSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const profile = await getUserProfile(user.id, supabase);

  return (
    <UserProvider initialUser={user} initialProfile={profile}>
      {children}
    </UserProvider>
  );
}

