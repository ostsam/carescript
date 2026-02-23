'use client';
import { AuthView } from '@neondatabase/auth/react';
import { useSession } from '@/lib/auth/client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthShell } from '../auth-shell';

export default function SignUpPage() {
  const { data } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (data?.user) {
      router.push('/dashboard');
    }
  }, [data, router]);

  return (
    <AuthShell variant="sign-up">
      <AuthView className="auth-view-card" pathname="sign-up" />
    </AuthShell>
  );
}
