import { UserProvider } from '@/lib/contexts/user-context';
import { getUserProfile, requireUser } from '@/lib/auth/session';

export default async function SaaSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const profile = await getUserProfile(user.id);

  return (
    <UserProvider initialUser={user} initialProfile={profile}>
      {children}
    </UserProvider>
  );
}

