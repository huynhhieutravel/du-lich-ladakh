import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, data: [] }), { status: 200 });

    const { results } = await db.prepare("SELECT * FROM Tag ORDER BY name ASC").all();
    return new Response(JSON.stringify({ success: true, data: results || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'No DB' }), { status: 500 });

    const body = await request.json();
    const { name, slug } = body;
    if (!name) return new Response(JSON.stringify({ success: false, message: 'Name required' }), { status: 400 });

    const id = `tag-${Date.now().toString(36)}`;
    await db.prepare("INSERT INTO Tag (id, name, slug) VALUES (?, ?, ?)").bind(id, name.trim(), slug?.trim() || name.toLowerCase()).run();

    return new Response(JSON.stringify({ success: true, data: { id, name, slug } }), { status: 201 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
