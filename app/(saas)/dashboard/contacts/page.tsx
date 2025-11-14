import { requireUser } from '@/lib/auth/session';
import { ContactsClient } from './contacts-client';

export default async function ContactsPage() {
  const user = await requireUser();

  return <ContactsClient email={user.email || ''} />;
}


