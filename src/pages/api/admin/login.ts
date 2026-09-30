import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyPassword, createToken } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ success: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const d1 = (env as any)?.ladakh_d1;
    let user: any = null;

    if (d1) {
      const res = await d1.prepare(
        'SELECT * FROM User WHERE email = ? OR slug = ? OR name = ? LIMIT 1'
      ).bind(username, username, username).first();
      if (res) user = res;
    }

    // Default admin fallback if DB not populated yet
    if (!user && (username === 'admin' || username === 'admin@dulichladakh.com')) {
      user = {
        id: 'admin-123',
        name: 'Admin Ladakh',
        email: 'admin@dulichladakh.com',
        role: 'admin',
        passwordHash: 'admin@ladakh2026'
      };
    }

    if (!user) {
      return new Response(JSON.stringify({ success: false, message: 'Tài khoản không tồn tại.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return new Response(JSON.stringify({ success: false, message: 'Mật khẩu không chính xác.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate token
    const token = await createToken({
      id: user.id || 'admin-123',
      name: user.name || 'Admin',
      email: user.email || 'admin@dulichladakh.com',
      role: user.role || 'admin'
    });

    // Set cookie
    cookies.set('ladakh_admin_token', token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return new Response(JSON.stringify({ success: true, redirectUrl: '/admin' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, message: error.message || 'Lỗi server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
