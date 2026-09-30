import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { verifyToken } from '../../../../lib/auth';

export const prerender = false;

// GET single tour
export const GET: APIRoute = async ({ params }) => {
  try {
    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const { id } = params;
    const tour = await db.prepare("SELECT * FROM Tour WHERE id = ?").bind(id).first();

    if (!tour) {
      return new Response(JSON.stringify({ success: false, message: 'Không tìm thấy tour' }), { status: 404 });
    }

    return new Response(JSON.stringify({ success: true, data: tour }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};

// PUT update tour
export const PUT: APIRoute = async ({ params, request, cookies }) => {
  try {
    const token = cookies.get('ladakh_admin_token')?.value;
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });

    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const { id } = params;
    const body = await request.json();
    const {
      title,
      slug,
      price,
      originalPrice,
      isFeatured,
      badge,
      durationDays,
      durationNights,
      departureLocation,
      transportation,
      featuredImage,
      gallery,
      overview,
      highlights,
      itinerary,
      included,
      excluded,
      terms,
      status,
      metaTitle,
      metaDescription
    } = body;

    const now = new Date().toISOString();

    await db.prepare(`
      UPDATE Tour SET 
        title = ?, slug = ?, price = ?, originalPrice = ?, isFeatured = ?, badge = ?,
        durationDays = ?, durationNights = ?, departureLocation = ?, transportation = ?,
        featuredImage = ?, gallery = ?, overview = ?, highlights = ?, itinerary = ?,
        included = ?, excluded = ?, terms = ?, status = ?, metaTitle = ?, metaDescription = ?,
        updatedAt = ?
      WHERE id = ?
    `).bind(
      title?.trim(),
      slug?.trim(),
      Number(price) || 0,
      Number(originalPrice) || 0,
      isFeatured ? 1 : 0,
      badge?.trim() || null,
      Number(durationDays) || 1,
      Number(durationNights) || 0,
      departureLocation?.trim() || null,
      transportation?.trim() || null,
      featuredImage || null,
      typeof gallery === 'string' ? gallery : JSON.stringify(gallery || []),
      overview?.trim() || null,
      typeof highlights === 'string' ? highlights : JSON.stringify(highlights || []),
      typeof itinerary === 'string' ? itinerary : JSON.stringify(itinerary || []),
      included?.trim() || null,
      excluded?.trim() || null,
      terms?.trim() || null,
      status || 'published',
      metaTitle?.trim() || title?.trim(),
      metaDescription?.trim() || overview?.slice(0, 160) || null,
      now,
      id
    ).run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};

// DELETE tour
export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    const token = cookies.get('ladakh_admin_token')?.value;
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });

    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const { id } = params;
    await db.prepare("DELETE FROM Tour WHERE id = ?").bind(id).run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
