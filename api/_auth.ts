import type { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Caller identity for the billing endpoints. The underscore prefix keeps this
// file out of Vercel's route table.
//
// These endpoints act on someone's billing account, so the user id has to come
// from a token the auth server has verified, never from the request body. A
// body-supplied id is just a claim the caller made about themselves.
const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

export type Caller = { id: string; email?: string };

export async function requireUser(req: VercelRequest): Promise<Caller | null> {
  const header = (req.headers.authorization as string) ?? '';
  if (!header.startsWith('Bearer ')) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? undefined };
}
