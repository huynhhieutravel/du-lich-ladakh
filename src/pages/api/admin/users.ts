import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { apiSuccess, apiError, withErrorHandler } from '../utils';

export const prerender = false;

// GET: Lấy danh sách users/tác giả cho dropdown bài viết
export const GET: APIRoute = withErrorHandler(async ({ locals }) => {
  const d1Db = (env as any)?.ladakh_d1;
  if (!d1Db) return apiError('Database binding missing', 500);

  const { results } = await d1Db.prepare('SELECT id, name, slug, email, avatar, role FROM "User" ORDER BY name ASC').all();
  return apiSuccess(results || []);
});
