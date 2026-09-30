import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiSuccess, apiError, withErrorHandler } from '@/pages/api/utils';

export const prerender = false;

// GET /api/admin/posts/[id]/revisions/[revId] — Lấy chi tiết toàn bộ nội dung bản cũ
export const GET: APIRoute = withErrorHandler(async ({ params, locals }) => {
  const authorize = (locals as any).authorize;
  if (!authorize('view', 'post')) return apiError('Forbidden', 403);

  const revId = params.revId;
  if (!revId) return apiError('Invalid revision ID', 400);

  const d1Db = env?.ladakh_d1;
  if (!d1Db) return apiError('Database missing', 500);

  const postId = String(params.id || '').trim();
  if (!postId) return apiError('Invalid post ID', 400);

  const revision = await d1Db.prepare(`
    SELECT * FROM PostRevision WHERE id = ? AND postId = ?
  `).bind(revId, postId).first<any>();

  if (!revision) {
    return apiError('Revision not found', 404);
  }

  // Parse categoryIds và tagIds
  try {
    revision.categoryIds = revision.categoryIds ? JSON.parse(revision.categoryIds) : [];
  } catch (e) {
    revision.categoryIds = [];
  }

  try {
    revision.tagIds = revision.tagIds ? JSON.parse(revision.tagIds) : [];
  } catch (e) {
    revision.tagIds = [];
  }

  return apiSuccess(revision);
});
