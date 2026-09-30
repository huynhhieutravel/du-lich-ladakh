import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { verifyToken } from '../../../lib/auth';

export const prerender = false;

// GET: All settings as a dictionary
export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const { results } = await db.prepare("SELECT * FROM SiteSetting").all();
    const settingsMap: Record<string, any> = {};

    (results || []).forEach((row: any) => {
      try {
        settingsMap[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      } catch (e) {
        settingsMap[row.key] = row.value;
      }
    });

    return new Response(JSON.stringify({ success: true, data: settingsMap }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};

// POST: Upsert settings
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const token = cookies.get('ladakh_admin_token')?.value;
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });

    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const body = await request.json();
    const now = new Date().toISOString();

    for (const [key, val] of Object.entries(body)) {
      const valStr = typeof val === 'object' ? JSON.stringify(val) : JSON.stringify(val);
      await db.prepare(`
        INSERT INTO SiteSetting (key, value, updatedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
      `).bind(key, valStr, now).run();
    }

    return new Response(JSON.stringify({ success: true, message: 'Cập nhật cài đặt thành công' }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
