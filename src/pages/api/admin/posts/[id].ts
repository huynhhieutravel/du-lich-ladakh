import type { APIRoute } from 'astro';
import slugify from 'slugify';
import { env } from 'cloudflare:workers';
import { apiSuccess, apiError, withErrorHandler } from '../../utils';
import { logAudit } from '../../../../lib/audit';

export const prerender = false;

// Helper: parse id từ URL params (Post.id là TEXT trong DB ladakh_d1)
function parseId(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

// GET: Lấy nội dung chi tiết của 1 bài viết để load vào Editor
export const GET: APIRoute = withErrorHandler(async ({ params, locals }) => {
  const authorize = (locals as any).authorize;
  if (!authorize('view', 'post')) return apiError('Forbidden', 403);
  const postId = parseId(params.id);
  if (!postId) return apiError('Invalid post ID', 400);

  const d1Db = env?.ladakh_d1;
  if (!d1Db) return apiError('Database missing', 500);

  const post = await d1Db.prepare("SELECT * FROM Post WHERE id = ?").bind(postId).first<any>();
  
  if (!post) {
    return apiError("Post not found", 404);
  }

  // PostCategory.postId là TEXT
  const { results: cats } = await d1Db.prepare(
    "SELECT categoryId FROM PostCategory WHERE postId = ?"
  ).bind(postId).all();
  post.categoryIds = cats ? cats.map((c: any) => c.categoryId) : [];

  const { results: tags } = await d1Db.prepare(
    "SELECT tagId FROM PostTag WHERE postId = ?"
  ).bind(postId).all();
  post.tagIds = tags ? tags.map((t: any) => t.tagId) : [];

  return apiSuccess(post);
});

// PUT: Cập nhật bài viết
export const PUT: APIRoute = withErrorHandler(async ({ request, params, locals }) => {
  const user = (locals as any).user;
  const authorize = (locals as any).authorize;

  const postId = parseId(params.id);
  if (!postId) return apiError('Invalid post ID', 400);

  const d1Db = env?.ladakh_d1;
  if (!d1Db) return apiError('Database missing', 500);

  const data: any = await request.json();
  
  const existing = await d1Db.prepare("SELECT * FROM Post WHERE id = ?").bind(postId).first<any>();
  if (!existing) {
    return apiError("Post not found", 404);
  }

  if (!authorize('edit', 'post', existing)) {
    console.warn(`[RBAC Blocked] User ${user?.userId} tried to edit post ${postId}`);
    return apiError('Bạn không có quyền cập nhật bài viết này.', 403);
  }

  const title = data.title;
  let slug = data.slug ? String(data.slug).trim() : '';
  if (!slug) {
    slug = existing.slug || slugify(title || 'post', { lower: true, strict: true, locale: 'vi' }) || Date.now().toString(36);
  }
  const status = data.status;
  const content = typeof data.content === 'object' ? JSON.stringify(data.content) : data.content;

  // Detect raw HTML for fallback defaults only
  const contentStr = typeof content === 'string' ? content.trim() : '';
  const isRawHtml = contentStr.startsWith('<') && !contentStr.startsWith('{');

  // isElementor: Trust frontend value. New posts NEVER auto-set isElementor.
  // Only legacy migrated posts have isElementor=1 in DB.
  const isElementor = data.isElementor ? 1 : 0;
  const contentFormat = data.contentFormat || (isRawHtml ? 'html' : 'json');

  const excerpt = data.excerpt || '';
  const featuredImage = data.featuredImage || '';
  const format = data.format || (isRawHtml ? 'landing' : 'standard');
  const isSticky = data.isSticky ? 1 : 0;
  const seoTitle = data.seoTitle || null;
  const seoDescription = data.seoDescription || null;
  const canonicalUrl = data.canonicalUrl || null;
  const focusKeyword = data.focusKeyword || null;
  const noindex = data.noindex ? 1 : 0;
  const nofollow = data.nofollow ? 1 : 0;
  const customSchema = data.customSchema || null;
  const updatedAt = new Date().toISOString();

  // Author Attribution: Resolve authorId → display name
  let authorId: string | null = data.authorId !== undefined ? (data.authorId || null) : (existing.authorId || null);
  let authorName: string | null = null;
  if (authorId) {
    const authorUser = await d1Db.prepare('SELECT id, name FROM "User" WHERE id = ?').bind(authorId).first<any>();
    if (authorUser) {
      authorName = authorUser.name;
    } else {
      authorId = existing.authorId || null; // Fallback to existing if invalid
    }
  } else if (data.authorId === null || data.authorId === '') {
    authorName = 'Admin';
    authorId = null;
  }

  // Smart Slug Validator
  const reservedSlugs = [
    'admin', 'api', 'go', 'blog', 'tour', 'about', 'contact',
    'chuyen-muc', 'tags', 'landing', 'preview-post', 'design',
    '_astro', 'assets', 'images', 'tag', 'category', 'author', 'tai-lieu',
    'favicon.ico', 'robots.txt', 'sitemap.xml', 'sitemap-index.xml', 'sitemap-0.xml', 'sitemap-blog.xml'
  ];
  if (reservedSlugs.includes(slug.toLowerCase())) {
    return apiError(`Đường dẫn "${slug}" là đường dẫn hệ thống, không được phép sử dụng.`, 409);
  }

  // Slug duplicate check across Post, Page, Tour, BlogCategory
  const [postDup, pageDup, tourDup, catDup] = await Promise.all([
    d1Db.prepare("SELECT id FROM Post WHERE slug = ? AND id != ?").bind(slug, postId).first(),
    d1Db.prepare("SELECT id FROM Page WHERE slug = ?").bind(slug).first(),
    d1Db.prepare("SELECT id FROM Tour WHERE slug = ?").bind(slug).first(),
    d1Db.prepare("SELECT id FROM BlogCategory WHERE slug = ?").bind(slug).first(),
  ]);

  if (postDup) {
    return apiError(`Cảnh báo: Đường dẫn "${slug}" đã tồn tại ở bài viết khác.`, 409, "Slug_Duplicate_Post");
  }
  if (pageDup) {
    return apiError(`Cảnh báo: Đường dẫn "${slug}" bị trùng với một Trang tĩnh (Page). Vui lòng chọn đường dẫn khác.`, 409, "Slug_Duplicate_Page");
  }
  if (tourDup) {
    return apiError(`Cảnh báo: Đường dẫn "${slug}" bị trùng với một Tour. Vui lòng chọn đường dẫn khác.`, 409, "Slug_Duplicate_Tour");
  }
  if (catDup) {
    return apiError(`Cảnh báo: Đường dẫn "${slug}" bị trùng với một Chuyên mục (Category). Vui lòng chọn đường dẫn khác.`, 409, "Slug_Duplicate_Category");
  }

  const categoryIds: string[] = Array.isArray(data.categoryIds) ? data.categoryIds : [];
  const tagIds: string[] = Array.isArray(data.tagIds) ? data.tagIds : [];
  // Post.categoryId is NOT NULL — fallback to existing value or first category in DB
  let categoryId = categoryIds.length > 0 ? categoryIds[0] : (data.categoryId || null);
  if (!categoryId) {
    // Try existing post's categoryId first
    categoryId = existing.categoryId || null;
  }
  if (!categoryId) {
    // Last resort: pick first category from DB
    const fallbackCat = await d1Db.prepare("SELECT id FROM BlogCategory LIMIT 1").first<any>();
    categoryId = fallbackCat?.id || '1';
  }

  const isDraftSave = data.isDraftSave === true;
  const isDraftDiscard = data.isDraftDiscard === true;

  if (isDraftDiscard) {
    await d1Db.prepare("UPDATE Post SET draftSnapshot = NULL WHERE id = ?").bind(postId).run();
    return apiSuccess({ id: postId });
  }

  if (isDraftSave && existing.status === 'published') {
    const snapshotPayload = JSON.stringify({
      title, slug, categoryId, categoryIds, tagIds, featuredImage, excerpt, content, format, isSticky, seoTitle, seoDescription, canonicalUrl, focusKeyword, noindex, nofollow, customSchema, isElementor, contentFormat, authorId
    });
    await d1Db.prepare("UPDATE Post SET draftSnapshot = ?, updatedAt = ? WHERE id = ?")
      .bind(snapshotPayload, updatedAt, postId).run();
  } else {
    // Snapshot version hiện tại vào PostRevision trước khi cập nhật đè nội dung mới
    try {
      const [{ results: oldCats }, { results: oldTags }] = await Promise.all([
        d1Db.prepare("SELECT categoryId FROM PostCategory WHERE postId = ?").bind(postId).all(),
        d1Db.prepare("SELECT tagId FROM PostTag WHERE postId = ?").bind(postId).all()
      ]);
      const oldCategoryIds = oldCats ? oldCats.map((c: any) => c.categoryId) : [];
      const oldTagIds = oldTags ? oldTags.map((t: any) => t.tagId) : [];

      const revId = 'rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      await d1Db.prepare(`
        INSERT INTO PostRevision (
          id, postId, title, slug, excerpt, content, contentFormat, featuredImage, format,
          categoryIds, tagIds, seoTitle, seoDescription, focusKeyword, canonicalUrl, author, authorId, changeNote, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        revId,
        postId,
        existing.title || '',
        existing.slug || '',
        existing.excerpt || '',
        existing.content || '',
        existing.contentFormat || 'json',
        existing.featuredImage || '',
        existing.format || 'standard',
        JSON.stringify(oldCategoryIds),
        JSON.stringify(oldTagIds),
        existing.seoTitle || null,
        existing.seoDescription || null,
        existing.focusKeyword || null,
        existing.canonicalUrl || null,
        existing.author || 'Admin',
        existing.authorId || null,
        'Cập nhật bài viết'
      ).run();

      // Dọn dẹp: Tối đa 20 bản ghi gần nhất cho bài viết này
      await d1Db.prepare(`
        DELETE FROM PostRevision 
        WHERE postId = ? 
          AND id NOT IN (
            SELECT id FROM PostRevision 
            WHERE postId = ? 
            ORDER BY createdAt DESC 
            LIMIT 20
          )
      `).bind(postId, postId).run();
    } catch (revErr) {
      console.warn(`[PUT /posts/${postId}] Failed to save revision snapshot:`, revErr);
    }

    // Phase 1: Update Post — this MUST succeed
    await d1Db.prepare(`
      UPDATE Post 
      SET title = ?, slug = ?, categoryId = ?, featuredImage = ?, excerpt = ?, content = ?, status = ?, updatedAt = ?, format = ?, isSticky = ?, seoTitle = ?, seoDescription = ?, canonicalUrl = ?, focusKeyword = ?, noindex = ?, nofollow = ?, customSchema = ?, isElementor = ?, contentFormat = ?, draftSnapshot = NULL, authorId = ?, author = COALESCE(?, author)
      WHERE id = ?
    `).bind(title, slug, categoryId, featuredImage, excerpt, content, status, updatedAt, format, isSticky, seoTitle, seoDescription, canonicalUrl, focusKeyword, noindex, nofollow, customSchema, isElementor, contentFormat, authorId, authorName, postId).run();

    // Phase 2: Update relationships — defensive, don't crash if FK fails
    try {
      const relStmts = [];
      relStmts.push(d1Db.prepare("DELETE FROM PostCategory WHERE postId = ?").bind(postId));
      relStmts.push(d1Db.prepare("DELETE FROM PostTag WHERE postId = ?").bind(postId));

      for (const cId of categoryIds) {
        relStmts.push(d1Db.prepare("INSERT OR IGNORE INTO PostCategory (postId, categoryId) VALUES (?, ?)").bind(postId, cId));
      }
      for (const tId of tagIds) {
        relStmts.push(d1Db.prepare("INSERT OR IGNORE INTO PostTag (postId, tagId) VALUES (?, ?)").bind(postId, tId));
      }

      if (relStmts.length > 0) {
        await d1Db.batch(relStmts);
      }
    } catch (relErr) {
      console.warn(`[PUT /posts/${postId}] PostCategory/PostTag batch failed (non-fatal):`, relErr);
      // Post data is already saved — relationships failure is not critical
    }
  }

  // Ghi Audit Log
  const ipAddress = request.headers.get('CF-Connecting-IP') || null;
  const userAgent = request.headers.get('User-Agent') || null;
  await logAudit(d1Db, user?.userId || user?.id, null, 'edit_post', ipAddress, userAgent, { postId });

  return apiSuccess({ id: postId, updatedAt });
});

// DELETE: Soft delete (default) or Permanent delete (?permanent=1)
export const DELETE: APIRoute = withErrorHandler(async ({ params, locals, request, url }) => {
  const user = (locals as any).user;
  const authorize = (locals as any).authorize;

  const postId = parseId(params.id);
  if (!postId) return apiError('Invalid post ID', 400);

  const d1Db = env?.ladakh_d1;
  if (!d1Db) return apiError('Database missing', 500);

  const existing = await d1Db.prepare("SELECT id, authorId, status FROM Post WHERE id = ?").bind(postId).first<any>();
  if (!existing) {
    return apiError("Post not found", 404);
  }

  if (!authorize('delete', 'post', existing)) {
    console.warn(`[RBAC Blocked] User ${user?.userId} tried to delete post ${postId}`);
    return apiError('Bạn không có quyền xoá bài viết này.', 403);
  }

  const permanent = url.searchParams.get('permanent') === '1';

  if (permanent) {
    // Hard delete: Xóa vĩnh viễn khỏi DB — slug sẽ được giải phóng
    if (existing.status !== 'trash') {
      return apiError('Chỉ có thể xóa vĩnh viễn bài viết đang ở trong Thùng rác.', 400);
    }
    await d1Db.batch([
      d1Db.prepare("DELETE FROM PostCategory WHERE postId = ?").bind(postId),
      d1Db.prepare("DELETE FROM PostTag WHERE postId = ?").bind(postId),
      d1Db.prepare("DELETE FROM Post WHERE id = ?").bind(postId),
    ]);
    return apiSuccess({ id: postId, permanentlyDeleted: true });
  } else {
    // Soft delete: Chuyển vào thùng rác
    const updatedAt = new Date().toISOString();
    await d1Db.prepare("UPDATE Post SET status = 'trash', updatedAt = ? WHERE id = ?")
      .bind(updatedAt, postId).run();

    const ipAddress = request.headers.get('CF-Connecting-IP') || null;
    const userAgent = request.headers.get('User-Agent') || null;
    await logAudit(d1Db, user?.userId || user?.id, null, 'trash_post', ipAddress, userAgent, { postId });

    return apiSuccess({ id: postId });
  }
});

// PATCH: Restore from trash
export const PATCH: APIRoute = withErrorHandler(async ({ params, locals, request }) => {
  const user = (locals as any).user;
  const authorize = (locals as any).authorize;

  const postId = parseId(params.id);
  if (!postId) return apiError('Invalid post ID', 400);

  const d1Db = env?.ladakh_d1;
  if (!d1Db) return apiError('Database missing', 500);

  const existing = await d1Db.prepare("SELECT id, authorId, status FROM Post WHERE id = ?").bind(postId).first<any>();
  if (!existing) return apiError("Post not found", 404);
  if (existing.status !== 'trash') return apiError("Bài viết này không ở trong thùng rác.", 400);

  if (!authorize('edit', 'post', existing)) {
    return apiError('Bạn không có quyền phục hồi bài viết này.', 403);
  }

  const updatedAt = new Date().toISOString();
  await d1Db.prepare("UPDATE Post SET status = 'draft', updatedAt = ? WHERE id = ?")
    .bind(updatedAt, postId).run();

  const ipAddress = request.headers.get('CF-Connecting-IP') || null;
  const userAgent = request.headers.get('User-Agent') || null;
  await logAudit(d1Db, user?.userId || user?.id, null, 'restore_post', ipAddress, userAgent, { postId });

  return apiSuccess({ id: postId, restoredTo: 'draft' });
});
