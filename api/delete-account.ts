import type { VercelRequest, VercelResponse } from '@vercel/node';
import { deleteAccountForToken } from './_delete-account-core';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const header = (req.headers.authorization as string) ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const result = await deleteAccountForToken(process.env, token);

    if ('error' in result) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[delete-account]', e);
    return res.status(500).json({ error: 'Could not delete account' });
  }
}
