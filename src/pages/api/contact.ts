import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';

export const prerender = false;

// Public API for contact, booking and consultation leads
export const POST: APIRoute = async ({ request }) => {
  try {
    const db = (env as any)?.ladakh_d1;
    if (!db) {
      return new Response(JSON.stringify({ success: false, message: 'DB not connected' }), { status: 500 });
    }

    const body = await request.json();
    const {
      formType = 'consultation',
      customerName,
      customerPhone,
      customerEmail,
      tourName,
      options,
      sourceUrl
    } = body;

    if (!customerPhone && !customerEmail) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Vui lòng cung cấp số điện thoại hoặc email liên hệ'
      }), { status: 400 });
    }

    const now = new Date().toISOString();
    const optionsStr = typeof options === 'object' ? JSON.stringify(options) : (options || '');

    await db.prepare(`
      INSERT INTO FormSubmission (
        formType, customerName, customerPhone, customerEmail, tourName, options, sourceUrl, status, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)
    `).bind(
      formType,
      customerName?.trim() || 'Khách vãng lai',
      customerPhone?.trim() || null,
      customerEmail?.trim() || null,
      tourName?.trim() || 'Tư vấn du lịch Ladakh chung',
      optionsStr,
      sourceUrl || null,
      now,
      now
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Cảm ơn bạn! Chuyên viên tư vấn Ladakh của chúng tôi sẽ liên hệ trong ít phút.'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
