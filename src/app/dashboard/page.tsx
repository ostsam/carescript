import { auth } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { data: session } = await auth.getSession();

  if (!session?.user) {
    redirect('/auth/sign-in');
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Dashboard</h1>
      <p>Signed in as: <strong>{session.user.name || session.user.email}</strong></p>
      <p>User ID: <code>{session.user.id}</code></p>
    </div>
  );
}
