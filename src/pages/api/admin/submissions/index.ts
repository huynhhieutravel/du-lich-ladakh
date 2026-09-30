import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { verifyToken } from '../../../../lib/auth';

export const prerender = false;

// GET all submissions with filter
export const GET: APIRoute = async ({ request, cookies, url }) => {
  try {
    const token = cookies.get('ladakh_admin_token')?.value;
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });

    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const status = url.searchParams.get('status');
    const formType = url.searchParams.get('type');
    const search = url.searchParams.get('q');

    let query = `SELECT * FROM FormSubmission WHERE 1=1`;
    const params: any[] = [];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (formType) {
      query += ` AND formType = ?`;
      params.push(formType);
    }
    if (search) {
      query += ` AND (customerName LIKE ? OR customerPhone LIKE ? OR customerEmail LIKE ? OR tourName LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY id DESC`;

    const { results } = await db.prepare(query).bind(...params).all();
    return new Response(JSON.stringify({ success: true, data: results || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};

// PATCH update status & notes
export const PATCH: APIRoute = async ({ request, cookies }) => {
  try {
    const token = cookies.get('ladakh_admin_token')?.value;
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });

    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const body = await request.json();
    const { id, status, notes } = body;
    if (!id) {
      return new Response(JSON.stringify({ success: false, message: 'ID is required' }), { status: 400 });
    }

    const now = new Date().toISOString();
    let query = `UPDATE FormSubmission SET updatedAt = ?`;
    const paramsArr: any[] = [now];

    if (status !== undefined) {
      query += `, status = ?`;
      paramsArr.push(status);
    }
    if (notes !== undefined) {
      query += `, notes = ?`;
      paramsArr.push(notes);
    }

    query += ` WHERE id = ?`;
    paramsArr.push(Number(id));

    await db.prepare(query).bind(...paramsArr).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};

// DELETE submission
export const DELETE: APIRoute = async ({ request, cookies }) => {
  try {
    const token = cookies.get('ladakh_admin_token')?.value;
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });

    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    let id: any = null;
    try {
      const body = await request.json();
      id = body?.id;
    } catch {
      const url = new URL(request.url);
      id = url.searchParams.get('id');
    }

    if (!id) {
      return new Response(JSON.stringify({ success: false, message: 'ID is required' }), { status: 400 });
    }

    await db.prepare("DELETE FROM FormSubmission WHERE id = ?").bind(Number(id)).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
