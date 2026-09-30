import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { verifyToken } from '../../../../lib/auth';

export const prerender = false;

// GET: All tours with search and filter
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const status = url.searchParams.get('status');
    const search = url.searchParams.get('q');

    let query = `SELECT * FROM Tour WHERE 1=1`;
    const params: any[] = [];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (search) {
      query += ` AND (title LIKE ? OR overview LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY isFeatured DESC, durationDays ASC, createdAt DESC`;

    const { results } = await db.prepare(query).bind(...params).all();
    return new Response(JSON.stringify({ success: true, data: results || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};

// POST: Create new tour
export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const token = cookies.get('ladakh_admin_token')?.value;
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });

    const db = (env as any)?.ladakh_d1;
    if (!db) return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });

    const body = await request.json();
    const {
      title,
      slug,
      price = 0,
      originalPrice = 0,
      isFeatured = 0,
      badge = '',
      durationDays = 1,
      durationNights = 0,
      departureLocation = 'Leh (Ấn Độ)',
      transportation = 'SUV 4x4',
      featuredImage = '',
      gallery = [],
      overview = '',
      highlights = [],
      itinerary = [],
      included = '',
      excluded = '',
      terms = '',
      status = 'published',
      metaTitle = '',
      metaDescription = ''
    } = body;

    if (!title || !slug) {
      return new Response(JSON.stringify({ success: false, message: 'Tiêu đề và đường dẫn slug là bắt buộc' }), { status: 400 });
    }

    const tourId = `tour-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO Tour (
        id, title, slug, price, originalPrice, isFeatured, badge,
        durationDays, durationNights, departureLocation, transportation,
        featuredImage, gallery, overview, highlights, itinerary,
        included, excluded, terms, status, metaTitle, metaDescription,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      String(tourId),
      title.trim(),
      slug.trim(),
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
      metaTitle?.trim() || title.trim(),
      metaDescription?.trim() || overview?.slice(0, 160) || null,
      now,
      now
    ).run();

    return new Response(JSON.stringify({ success: true, data: { id: tourId, slug } }), { status: 201 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
