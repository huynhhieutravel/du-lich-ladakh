import type { APIRoute } from 'astro';
import slugify from 'slugify';
import { env } from 'cloudflare:workers';
import { apiSuccess, apiError, withErrorHandler } from '../../utils';
import { logAudit } from '../../../../lib/audit';

export const prerender = false;

// GET: Lấy danh sách posts cho bảng
export const GET: APIRoute = withErrorHandler(async ({ locals }) => {
  const authorize = (locals as any).authorize;
  if (!authorize('view', 'post')) return apiError('Forbidden', 403);

  const d1Db = env?.ladakh_d1;
  if (!d1Db) return apiError('Database missing', 500);

  const { results } = await d1Db.prepare(`
    SELECT Post.*, BlogCategory.name as categoryName 
    FROM Post 
    LEFT JOIN BlogCategory ON Post.categoryId = BlogCategory.id 
    ORDER BY Post.createdAt DESC LIMIT 100
  `).all();
  
  return apiSuccess(results);
});

// POST: Tạo một draft mới
export const POST: APIRoute = withErrorHandler(async ({ request, locals }) => {
  const user = (locals as any).user;
  const authorize = (locals as any).authorize;
  
  if (!authorize('create', 'post')) {
    console.warn(`[RBAC Blocked] User ${user?.userId} tried to create a post.`);
    return apiError('Forbidden', 403);
  }

  const d1Db = env?.ladakh_d1;
  if (!d1Db) return apiError('Database missing', 500);

  const data: any = await request.json();
  const title = data.title || 'Untitled Draft';
  
  // Auto generate slug
  let slug = data.slug;
  if (!slug) {
    const ts = Date.now().toString(36);
    slug = slugify(title, { lower: true, strict: true, locale: 'vi' }) || ts;
  }
  
  // Validate unique slug across Post, Page, Tour, BlogCategory
  let isUnique = false;
  let counter = 0;
  let finalSlug = slug;
  
  // Reserved Slug check (Sync with middleware)
  const reservedSlugs = [
    'admin', 'api', 'go', 'blog', 'tour', 'about', 'contact',
    'chuyen-muc', 'tags', 'landing', 'preview-post', 'design',
    '_astro', 'assets', 'images', 'tag', 'category', 'author', 'tai-lieu',
    'favicon.ico', 'robots.txt', 'sitemap.xml', 'sitemap-index.xml', 'sitemap-0.xml', 'sitemap-blog.xml'
  ];
  if (reservedSlugs.includes(finalSlug.toLowerCase())) {
    finalSlug = `${finalSlug}-post`;
  }

  while (!isUnique) {
    const [postCheck, pageCheck, tourCheck, catCheck] = await Promise.all([
      d1Db.prepare("SELECT id FROM Post WHERE slug = ?").bind(finalSlug).first(),
      d1Db.prepare("SELECT id FROM Page WHERE slug = ?").bind(finalSlug).first(),
      d1Db.prepare("SELECT id FROM Tour WHERE slug = ?").bind(finalSlug).first(),
      d1Db.prepare("SELECT id FROM BlogCategory WHERE slug = ?").bind(finalSlug).first(),
    ]);

    if (postCheck || pageCheck || tourCheck || catCheck) {
      counter++;
      finalSlug = `${slug}-${counter}`;
      if (reservedSlugs.includes(finalSlug.toLowerCase())) finalSlug = `${finalSlug}-post`;
    } else {
      isUnique = true;
    }
  }

  const categoryIds: string[] = Array.isArray(data.categoryIds) ? data.categoryIds : [];
  const tagIds: string[] = Array.isArray(data.tagIds) ? data.tagIds : [];

  // Tìm categoryId hợp lệ
  let categoryId = categoryIds.length > 0 ? categoryIds[0] : (data.categoryId || null);
  if (!categoryId) {
    const fallbackCat = await d1Db.prepare("SELECT id FROM BlogCategory LIMIT 1").first<any>();
    categoryId = fallbackCat?.id || null;
  }
  
  const status = data.status || 'draft';
  const content = data.content ? (typeof data.content === 'string' ? data.content : JSON.stringify(data.content)) : JSON.stringify({ type: 'doc', content: [] });

  // Detect raw HTML for fallback defaults only
  const contentStr = typeof content === 'string' ? content.trim() : '';
  const isRawHtml = contentStr.startsWith('<') && !contentStr.startsWith('{');

  // isElementor: Trust frontend value. New posts NEVER auto-set isElementor.
  const isElementor = data.isElementor ? 1 : 0;
  const contentFormat = data.contentFormat || (isRawHtml ? 'html' : 'json');
  const contentVersion = data.contentVersion || (contentFormat === 'json' ? 3 : 2);

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
  const createdAt = new Date().toISOString();

  // Validate authorId — ưu tiên payload (Admin chọn tác giả khác), fallback sang user đang login
  let authorId: string | null = data.authorId || user?.userId || null;
  let authorName: string = user?.username || 'Admin';
  if (authorId) {
    const authorUser = await d1Db.prepare('SELECT id, name FROM "User" WHERE id = ?').bind(authorId).first<any>();
    if (authorUser) {
      authorName = authorUser.name || authorName;
    } else {
      console.warn(`[POST /posts] authorId "${authorId}" not found in User table, setting to null`);
      authorId = null;
    }
  }

  // Post.id is TEXT PRIMARY KEY in ladakh_d1
  const postIdStr = `post-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  // INSERT với id string chuẩn
  await d1Db.prepare(`
    INSERT INTO Post (id, title, slug, categoryId, featuredImage, excerpt, content, type, status, author, createdAt, format, isSticky, seoTitle, seoDescription, canonicalUrl, contentFormat, focusKeyword, noindex, nofollow, customSchema, isElementor, authorId)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'blog', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(postIdStr, title, finalSlug, categoryId, featuredImage, excerpt, content, status, authorName, createdAt, format, isSticky, seoTitle, seoDescription, canonicalUrl, contentFormat, focusKeyword, noindex, nofollow, customSchema, isElementor, authorId).run();

  // Insert PostCategory & PostTag
  const stmts = [];
  for (const cId of categoryIds) {
    stmts.push(d1Db.prepare("INSERT INTO PostCategory (postId, categoryId) VALUES (?, ?)").bind(postIdStr, cId));
  }
  for (const tId of tagIds) {
    stmts.push(d1Db.prepare("INSERT INTO PostTag (postId, tagId) VALUES (?, ?)").bind(postIdStr, tId));
  }

  if (stmts.length > 0) {
    try {
      await d1Db.batch(stmts);
    } catch (e) {
      console.warn(`[POST /posts] PostCategory/PostTag batch failed for post ${newId}:`, e);
    }
  }

  // Snapshot bản khởi tạo đầu tiên (v1) vào PostRevision
  try {
    const revId = 'rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    await d1Db.prepare(`
      INSERT INTO PostRevision (
        id, postId, title, slug, excerpt, content, contentFormat, featuredImage, format,
        categoryIds, tagIds, seoTitle, seoDescription, focusKeyword, canonicalUrl, author, authorId, changeNote, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      revId,
      postIdStr,
      title,
      finalSlug,
      excerpt,
      content,
      contentFormat,
      featuredImage,
      format,
      JSON.stringify(categoryIds),
      JSON.stringify(tagIds),
      seoTitle,
      seoDescription,
      focusKeyword,
      canonicalUrl,
      authorName,
      authorId,
      'Khởi tạo bài viết'
    ).run();
  } catch (revErr) {
    console.warn(`[POST /posts] Failed to save initial revision for post ${newId}:`, revErr);
  }

  // Ghi Audit Log
  const ipAddress = request.headers.get('CF-Connecting-IP') || null;
  const userAgent = request.headers.get('User-Agent') || null;
  await logAudit(d1Db, user?.userId || user?.id, null, 'create_post', ipAddress, userAgent, { postId: newId, title });

  return apiSuccess({ id: postIdStr, slug: finalSlug, title, status }, 201);
});
