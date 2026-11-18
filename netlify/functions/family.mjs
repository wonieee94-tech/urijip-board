import { getStore } from '@netlify/blobs';
import { handle } from './lib/family.mjs';

export default async (req) => {
  const blobs = getStore({ name: 'families', consistency: 'strong' });
  const store = {
    get: (k) => blobs.get(k, { type: 'json' }),
    set: (k, v) => blobs.setJSON(k, v),
    del: (k) => blobs.delete(k),
  };
  let body = null;
  if (req.method === 'POST') {
    try { body = await req.json(); } catch { body = null; }
  }
  const { status, data } = await handle(req.method, req.url, body, store);
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
};

export const config = { path: '/api/family' };
