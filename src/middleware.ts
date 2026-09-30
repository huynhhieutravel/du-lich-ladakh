import { defineMiddleware } from 'astro:middleware';
import { verifyToken } from './lib/auth';
import { env } from 'cloudflare:workers';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // ========== LINK MANAGER SHORT URL REDIRECT (Before Auth) ==========
  const RESERVED = new Set([
    'admin', 'api', '_astro', 'assets', 'images', 'uploads',
    'favicon.ico', 'robots.txt', 'sitemap.xml', 'tour', 'posts', 'pages', 
    'gioi-thieu', 'lien-he', 'chinh-sach-bao-mat', 'dieu-khoan-su-dung'
  ]);
  const firstSegment = pathname.split('/')[1]?.toLowerCase();

  // If first segment is non-empty, not reserved, and not a static file asset
  if (firstSegment && !RESERVED.has(firstSegment) && !pathname.includes('.')) {
    try {
      const db = (env as any)?.ladakh_d1;
      if (db) {
        const slug = pathname.replace(/^\//, '').toLowerCase();
        const link = await db.prepare("SELECT slug, url, statusCode, target, rel, isActive FROM Link WHERE slug = ? AND isActive = 1").bind(slug).first<any>();
        
        if (link && link.url) {
          const u = new URL(link.url);
          const allowed = ['http:', 'https:', 'mailto:', 'tel:', 'sms:', 'zalo:'];
          if (allowed.includes(u.protocol)) {
            const sc = link.statusCode || 302;
            return new Response(null, {
              status: sc,
              headers: {
                'Location': link.url,
                'Cache-Control': sc === 301
                  ? 'public, max-age=3600'
                  : 'no-store, no-cache, must-revalidate, max-age=0'
              }
            });
          }
        }
      }
    } catch (e) {
      console.warn('Link redirect error:', e);
    }
  }

  // Setup default authorize helper
  (context.locals as any).authorize = () => true;

  // Extract and verify admin token
  const token = context.cookies.get('ladakh_admin_token')?.value;
  const user = token ? await verifyToken(token) : null;
  if (user) {
    (context.locals as any).user = user;
  }

  // Protect /admin routes
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!user) {
      return context.redirect('/admin/login');
    }
  }

  // Protect /api/admin routes (return 401 JSON instead of redirect)
  if (pathname.startsWith('/api/admin') && pathname !== '/api/admin/login') {
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // If already logged in and visiting /admin/login, redirect to /admin
  if (pathname === '/admin/login') {
    if (user) {
      return context.redirect('/admin');
    }
  }

  return next();
});
