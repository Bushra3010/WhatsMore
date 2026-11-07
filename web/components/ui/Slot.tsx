'use client';
import { slots } from '@/lib/registry';

/** Renders whatever other areas registered for this slot name (see lib/registry `slots`). */
export function Slot({ name, ...props }: { name: string } & Record<string, unknown>) {
  const list = slots[name] || [];
  return <>{list.map((C, i) => <C key={i} {...props} />)}</>;
}
