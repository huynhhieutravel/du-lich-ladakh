import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { verifyToken } from '../../../../lib/auth';

export const prerender = false;

// PATCH update status & notes
export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('ladakh_admin_token')?.value;
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });

    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const { id } = params;
    const body = await request.json();
    const { status, notes } = body;

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

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};

// DELETE submission
export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    const token = cookies.get('ladakh_admin_token')?.value;
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });

    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const { id } = params;
    await db.prepare("DELETE FROM FormSubmission WHERE id = ?").bind(Number(id)).run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
