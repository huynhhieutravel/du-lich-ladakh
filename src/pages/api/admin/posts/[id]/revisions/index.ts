import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiSuccess, apiError, withErrorHandler } from '@/pages/api/utils';

export const prerender = false;

function parseId(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

// GET /api/admin/posts/[id]/revisions — Lấy danh sách các phiên bản đã lưu
export const GET: APIRoute = withErrorHandler(async ({ params, locals }) => {
  const authorize = (locals as any).authorize;
  if (!authorize('view', 'post')) return apiError('Forbidden', 403);

  const postId = parseId(params.id);
  if (!postId) return apiError('Invalid post ID', 400);

  const d1Db = env?.ladakh_d1;
  if (!d1Db) return apiError('Database missing', 500);

  const { results: revisions } = await d1Db.prepare(`
    SELECT 
      id, postId, title, slug, excerpt, featuredImage, format, contentFormat,
      author, authorId, changeNote, createdAt,
      LENGTH(content) AS contentLength
    FROM PostRevision
    WHERE postId = ?
    ORDER BY createdAt DESC
    LIMIT 30
  `).bind(postId).all();

  return apiSuccess(revisions || []);
});
