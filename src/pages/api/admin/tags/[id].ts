import { env } from 'cloudflare:workers';
import slugify from 'slugify';
import { apiSuccess, apiError, withErrorHandler } from '@/pages/api/utils';

export const prerender = false;

export const PUT = withErrorHandler(async ({ request, params, locals }) => {
  const authorize = (locals as any).authorize;
  if (!authorize('edit', 'post')) return apiError('Forbidden', 403);
  const d1Db = env?.ladakh_d1;
  if (!d1Db) return apiError('DB error', 500);

  const id = params.id;
  if (!id) return apiError('ID is required', 400);

  const body = await request.json();
  const { name, slug } = body;

  if (!name) return apiError('Vui lòng nhập tên tag', 400);

  const finalSlug = slug || slugify(name, { lower: true, strict: true, locale: 'vi' });

  // check duplicate slug
  const existing = await d1Db.prepare("SELECT id FROM Tag WHERE slug = ? AND id != ?").bind(finalSlug, id).first();
  if (existing) {
    return apiError('Đường dẫn (Slug) này đã tồn tại, vui lòng chọn đường dẫn khác', 400);
  }

  await d1Db.prepare(
    "UPDATE Tag SET name = ?, slug = ? WHERE id = ?"
  ).bind(name, finalSlug, id).run();

  return apiSuccess({ id, name, slug: finalSlug });
});

export const DELETE = withErrorHandler(async ({ params, locals }) => {
  const authorize = (locals as any).authorize;
  if (!authorize('delete', 'post')) return apiError('Forbidden', 403);
  const d1Db = env?.ladakh_d1;
  if (!d1Db) return apiError('DB error', 500);

  const id = params.id;
  if (!id) return apiError('ID is required', 400);

  // DELETE Tag
  await d1Db.prepare("DELETE FROM Tag WHERE id = ?").bind(id).run();
  await d1Db.prepare("DELETE FROM PostTag WHERE tagId = ?").bind(id).run();

  return apiSuccess(null);
});
