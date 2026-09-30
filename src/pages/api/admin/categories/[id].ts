import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import slugify from 'slugify';
import { apiSuccess, apiError, withErrorHandler } from '@/pages/api/utils';

export const prerender = false;

export const PUT: APIRoute = withErrorHandler(async ({ request, params, locals }) => {
  const authorize = (locals as any).authorize;
  if (!authorize('edit', 'post')) return apiError('Forbidden', 403);
  const d1Db = env?.ladakh_d1;
  if (!d1Db) return apiError('DB error', 500);

  const id = params.id;
  if (!id) return apiError('ID is required', 400);

  const body = await request.json();
  const { name, slug, parentId, description } = body;

  if (!name) return apiError('Vui lòng nhập tên danh mục', 400);

  const finalSlug = slug || slugify(name, { lower: true, strict: true, locale: 'vi' });

  // Ngăn chặn self-parenting
  if (parentId === id) {
    return apiError('Không thể chọn danh mục cha là chính nó', 400);
  }

  const existing = await d1Db.prepare("SELECT id FROM BlogCategory WHERE slug = ? AND id != ?").bind(finalSlug, id).first();
  if (existing) return apiError('Đường dẫn (Slug) này đã tồn tại, vui lòng chọn đường dẫn khác', 400);

  await d1Db.prepare(
    "UPDATE BlogCategory SET name = ?, slug = ?, parentId = ?, description = ? WHERE id = ?"
  ).bind(name, finalSlug, parentId || null, description || '', id).run();

  return apiSuccess(null, 200);
});

export const DELETE: APIRoute = withErrorHandler(async ({ params, locals }) => {
  const authorize = (locals as any).authorize;
  if (!authorize('delete', 'post')) return apiError('Forbidden', 403);
  const d1Db = env?.ladakh_d1;
  if (!d1Db) return apiError('DB error', 500);

  const id = params.id;
  if (!id) return apiError('ID is required', 400);

  // Ngăn chặn xoá nếu có category con
  const children = await d1Db.prepare("SELECT id FROM BlogCategory WHERE parentId = ?").bind(id).first();
  if (children) {
    return apiError('Không thể xoá danh mục này vì đang chứa danh mục con. Vui lòng xoá hoặc chuyển danh mục con trước.', 400);
  }

  // Ngăn chặn xoá nếu đang có bài viết sử dụng danh mục này
  const postsUsingCategory = await d1Db.prepare("SELECT id FROM Post WHERE categoryId = ? OR EXISTS (SELECT 1 FROM PostCategory WHERE PostCategory.categoryId = ?)").bind(id, id).first();
  if (postsUsingCategory) {
    return apiError('Không thể xoá vì đang có bài viết sử dụng danh mục này. Vui lòng chuyển các bài viết sang danh mục khác trước.', 400);
  }

  await d1Db.prepare("DELETE FROM BlogCategory WHERE id = ?").bind(id).run();

  return apiSuccess(null, 200);
});
