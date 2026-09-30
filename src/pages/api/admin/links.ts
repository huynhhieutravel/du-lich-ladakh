import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyToken } from '@/lib/auth';

export const prerender = false;

async function checkAuth(context: any) {
  if (context.locals?.user) return context.locals.user;
  const token = context.cookies?.get('ladakh_admin_token')?.value;
  if (token) {
    return await verifyToken(token);
  }
  return null;
}

// GET — List all links
export const GET: APIRoute = async (context) => {
  const user = await checkAuth(context);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const db = (env as any)?.ladakh_d1;
  if (!db) {
    return new Response(JSON.stringify({ error: 'Database binding missing' }), { status: 500 });
  }

  try {
    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const totalRow = await db.prepare("SELECT COUNT(*) as total FROM Link").first<{ total: number }>();
    const total = totalRow?.total || 0;

    const { results } = await db.prepare("SELECT * FROM Link ORDER BY createdAt DESC LIMIT ? OFFSET ?")
      .bind(limit, offset)
      .all();

    return new Response(JSON.stringify({
      success: true,
      data: results || [],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

// POST — Create new link
export const POST: APIRoute = async (context) => {
  const user = await checkAuth(context);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const db = (env as any)?.ladakh_d1;
  if (!db) {
    return new Response(JSON.stringify({ error: 'Database binding missing' }), { status: 500 });
  }

  try {
    const body = await context.request.json();
    let { slug, label, url, statusCode, target, rel, isActive } = body;

    slug = slug?.trim().toLowerCase().replace(/^\//, '').replace(/[^a-z0-9-_]/g, '-');
    label = label?.trim();
    url = url?.trim();

    if (!slug || !label || !url) {
      return new Response(JSON.stringify({ error: 'Slug, Tên hiển thị và URL đích là bắt buộc' }), { status: 400 });
    }

    // Validate URL protocol
    try {
      const parsedUrl = new URL(url);
      const allowed = ['http:', 'https:', 'mailto:', 'tel:', 'sms:', 'zalo:'];
      if (!allowed.includes(parsedUrl.protocol)) {
        return new Response(JSON.stringify({ error: 'Giao thức URL không hợp lệ (chỉ cho phép http, https, mailto, tel, sms, zalo)' }), { status: 400 });
      }
    } catch {
      return new Response(JSON.stringify({ error: 'URL đích không hợp lệ' }), { status: 400 });
    }

    // Check slug uniqueness
    const existing = await db.prepare("SELECT slug FROM Link WHERE slug = ?").bind(slug).first();
    if (existing) {
      return new Response(JSON.stringify({ error: `Đường dẫn tắt "${slug}" đã tồn tại. Vui lòng chọn slug khác.` }), { status: 409 });
    }

    await db.prepare(`
      INSERT INTO Link (slug, label, url, statusCode, target, rel, isActive, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      slug,
      label,
      url,
      parseInt(statusCode, 10) || 302,
      target || '_blank',
      rel || 'nofollow sponsored',
      isActive ? 1 : 0
    ).run();

    return new Response(JSON.stringify({ success: true, message: 'Đã tạo link thành công' }), { status: 201 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

// PATCH — Update existing link by slug
export const PATCH: APIRoute = async (context) => {
  const user = await checkAuth(context);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const db = (env as any)?.ladakh_d1;
  if (!db) {
    return new Response(JSON.stringify({ error: 'Database binding missing' }), { status: 500 });
  }

  try {
    const body = await context.request.json();
    const { slug, label, url, statusCode, target, rel, isActive } = body;

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug là bắt buộc' }), { status: 400 });
    }

    const updates: string[] = [];
    const bindings: any[] = [];

    if (label !== undefined) {
      updates.push("label = ?");
      bindings.push(label.trim());
    }

    if (url !== undefined) {
      const trimmedUrl = url.trim();
      const parsedUrl = new URL(trimmedUrl);
      const allowed = ['http:', 'https:', 'mailto:', 'tel:', 'sms:', 'zalo:'];
      if (!allowed.includes(parsedUrl.protocol)) {
        return new Response(JSON.stringify({ error: 'Giao thức URL không hợp lệ' }), { status: 400 });
      }
      updates.push("url = ?");
      bindings.push(trimmedUrl);
    }

    if (statusCode !== undefined) {
      updates.push("statusCode = ?");
      bindings.push(parseInt(statusCode, 10) || 302);
    }

    if (target !== undefined) {
      updates.push("target = ?");
      bindings.push(target);
    }

    if (rel !== undefined) {
      updates.push("rel = ?");
      bindings.push(rel);
    }

    if (isActive !== undefined) {
      updates.push("isActive = ?");
      bindings.push(isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'Không có dữ liệu thay đổi' }), { status: 400 });
    }

    bindings.push(slug);
    await db.prepare(`UPDATE Link SET ${updates.join(', ')} WHERE slug = ?`).bind(...bindings).run();

    return new Response(JSON.stringify({ success: true, message: 'Đã cập nhật link thành công' }));
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

// DELETE — Delete link by slug
export const DELETE: APIRoute = async (context) => {
  const user = await checkAuth(context);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const db = (env as any)?.ladakh_d1;
  if (!db) {
    return new Response(JSON.stringify({ error: 'Database binding missing' }), { status: 500 });
  }

  try {
    const body = await context.request.json();
    const { slug } = body;

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Slug là bắt buộc' }), { status: 400 });
    }

    await db.prepare("DELETE FROM Link WHERE slug = ?").bind(slug).run();

    return new Response(JSON.stringify({ success: true, message: 'Đã xóa link thành công' }));
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
