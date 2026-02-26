'use client';
import { NeonAuthUIProvider } from '@neondatabase/auth/react';
import '@neondatabase/auth/ui/css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <NeonAuthUIProvider
      authClient={authClient as any}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={router.refresh}
      Link={Link}
    >
      {children}
    </NeonAuthUIProvider>
  );
}
