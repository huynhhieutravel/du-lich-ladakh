import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { verifyToken } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const token = cookies.get('ladakh_admin_token')?.value;
    const authUser = token ? await verifyToken(token) : null;
    if (!authUser) {
      return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });
    }

    const db = (env as any)?.ladakh_d1;
    const r2 = (env as any)?.MEDIA_BUCKET;

    if (!r2 || !db) {
      return new Response(JSON.stringify({ success: false, message: 'R2 hoặc D1 chưa được cấu hình' }), { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return new Response(JSON.stringify({ success: false, message: 'Không tìm thấy file tải lên' }), { status: 400 });
    }

    const title = (formData.get('title') as string)?.trim() || '';
    const altText = (formData.get('altText') as string)?.trim() || '';
    const caption = (formData.get('caption') as string)?.trim() || '';
    const description = (formData.get('description') as string)?.trim() || '';

    const timestamp = Date.now();
    // Normalize filename to kebab-case
    const originalName = file.name;
    const ext = originalName.split('.').pop()?.toLowerCase() || 'webp';
    const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    const safeName = nameWithoutExt
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const r2Key = `uploads/${safeName}-${timestamp}.${ext}`;
    const fileBuffer = await file.arrayBuffer();

    await r2.put(r2Key, fileBuffer, {
      httpMetadata: {
        contentType: file.type || 'image/webp'
      }
    });

    const cdnBase = (env as any)?.PUBLIC_CDN_BASE || 'https://media.dulichladakh.com';
    const url = `${cdnBase}/${r2Key}`;
    const now = new Date().toISOString();

    const finalTitle = title || nameWithoutExt;
    const finalAlt = altText || finalTitle;
    const finalDesc = description || finalTitle;

    // Insert into D1 Media table with EXIF metadata
    const insertRes = await db.prepare(
      `INSERT INTO Media (filename, url, altText, title, caption, description, mimeType, sizeBytes, r2Key, folder, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'general', ?)`
    ).bind(
      file.name,
      url,
      finalAlt,
      finalTitle,
      caption,
      finalDesc,
      file.type || 'image/webp',
      file.size,
      r2Key,
      now
    ).run();

    const mediaId = insertRes.meta.last_row_id;

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: mediaId,
        url,
        filename: file.name,
        altText: finalAlt,
        title: finalTitle,
        caption,
        description: finalDesc,
        r2Key,
        mimeType: file.type || 'image/webp',
        sizeBytes: file.size,
        createdAt: now
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message || 'Lỗi tải ảnh' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
