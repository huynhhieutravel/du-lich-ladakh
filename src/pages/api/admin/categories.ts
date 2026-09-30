import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { verifyToken } from '../../../lib/auth';

export const prerender = false;

// GET: All categories with post count
export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const { results } = await db.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM Post p WHERE p.categoryId = c.id) as postCount
      FROM BlogCategory c
      ORDER BY c.name ASC
    `).all();

    return new Response(JSON.stringify({ success: true, data: results || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};

// POST: Create category
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const token = cookies.get('ladakh_admin_token')?.value;
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });

    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const body = await request.json();
    const { name, slug, description } = body;

    if (!name || !slug) {
      return new Response(JSON.stringify({ success: false, message: 'Tên và đường dẫn slug là bắt buộc' }), { status: 400 });
    }

    const id = `cat-${Date.now().toString(36)}`;
    await db.prepare(
      `INSERT INTO BlogCategory (id, name, slug, description, count) VALUES (?, ?, ?, ?, 0)`
    ).bind(id, name.trim(), slug.trim(), description?.trim() || '').run();

    return new Response(JSON.stringify({ success: true, data: { id, name, slug, description } }), { status: 201 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};

// PATCH: Update category
export const PATCH: APIRoute = async ({ request, cookies }) => {
  try {
    const token = cookies.get('ladakh_admin_token')?.value;
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });

    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const body = await request.json();
    const { id, name, slug, description } = body;

    if (!id || !name || !slug) {
      return new Response(JSON.stringify({ success: false, message: 'Thiếu thông tin cập nhật' }), { status: 400 });
    }

    await db.prepare(
      `UPDATE BlogCategory SET name = ?, slug = ?, description = ? WHERE id = ?`
    ).bind(name.trim(), slug.trim(), description?.trim() || '', id).run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};

// DELETE: Delete category
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const token = cookies.get('ladakh_admin_token')?.value;
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });

    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const { id } = await request.json();
    if (!id) return new Response(JSON.stringify({ success: false, message: 'Thiếu ID' }), { status: 400 });

    // Set posts with this category to NULL before deleting
    await db.prepare("UPDATE Post SET categoryId = NULL WHERE categoryId = ?").bind(id).run();
    await db.prepare("DELETE FROM BlogCategory WHERE id = ?").bind(id).run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
