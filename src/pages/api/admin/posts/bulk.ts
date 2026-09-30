import { env } from 'cloudflare:workers';
import { apiSuccess, apiError, withErrorHandler } from '@/pages/api/utils';

export const prerender = false;

export const PUT = withErrorHandler(async ({ request, locals }) => {
  const authorize = (locals as any).authorize;
  if (!authorize('edit', 'post')) return apiError('Forbidden', 403);
  const d1Db = env?.ladakh_d1;
  if (!d1Db) {
    return apiError('No D1 binding found', 500);
  }

  const body = await request.json();
  const { postIds: rawPostIds, data } = body;

  if (!rawPostIds || !Array.isArray(rawPostIds) || rawPostIds.length === 0) {
    return apiError('Invalid postIds payload', 400);
  }

  if (!data || (!data.categoryChanges && !data.status && data.author === undefined)) {
    return apiError('No data to update', 400);
  }

  // Post.id is TEXT PRIMARY KEY in ladakh_d1
  const postIds: string[] = rawPostIds
    .map((id: any) => String(id || '').trim())
    .filter((s: string) => s.length > 0);

  if (postIds.length === 0) {
    return apiError('No valid post IDs', 400);
  }

  const stmts = [];

  // 1. Handle Status & Primary Category Update (Post table)
  let postUpdates: string[] = [];
  let postValues: any[] = [];

  const catAdd = data.categoryChanges?.add || [];
  const catRemove = data.categoryChanges?.remove || [];

  if (catAdd.length > 0) {
    postUpdates.push("categoryId = ?");
    postValues.push(catAdd[0]);
  }
  if (data.status) {
    postUpdates.push("status = ?");
    postValues.push(data.status);
  }
  if (data.author !== undefined) {
    postUpdates.push("author = ?");
    postValues.push(data.author);
  }

  if (postUpdates.length > 0) {
    postUpdates.push("updatedAt = ?");
    postValues.push(new Date().toISOString());

    const updateStr = postUpdates.join(", ");
    const placeholders = postIds.map(() => "?").join(",");
    postValues.push(...postIds);

    stmts.push(d1Db.prepare(`UPDATE Post SET ${updateStr} WHERE id IN (${placeholders})`).bind(...postValues));
  }

  // 2. Handle Multiple Categories (PostCategory table)
  if (catRemove.length > 0) {
    const removePlaceholders = catRemove.map(() => "?").join(",");
    for (const postId of postIds) {
      stmts.push(
        d1Db.prepare(`DELETE FROM PostCategory WHERE postId = ? AND categoryId IN (${removePlaceholders})`)
          .bind(postId, ...catRemove)
      );
    }
  }

  if (catAdd.length > 0) {
    for (const postId of postIds) {
      for (const catId of catAdd) {
        stmts.push(
          d1Db.prepare(`INSERT OR IGNORE INTO PostCategory (postId, categoryId) VALUES (?, ?)`)
            .bind(postId, catId)
        );
      }
    }
  }

  if (stmts.length > 0) {
    await d1Db.batch(stmts);
  }

  return apiSuccess({ updated: postIds.length });
});
