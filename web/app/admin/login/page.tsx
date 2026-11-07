import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/LoginForm';
import { getAdmin } from '../_lib/auth';

export const metadata: Metadata = { title: 'Admin sign-in' };

/** Already signed in as an admin: go straight to the dashboard. */
async function SignedInRedirect() {
  if (await getAdmin()) redirect('/admin/dashboard');
  return null;
}

// Every Command Center page waits for the per-request admin check on the server, by design.
export const instant = false;

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login" />}>
      <SignedInRedirect />
      <LoginForm />
    </Suspense>
  );
}
