import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete('ladakh_admin_token', { path: '/' });
  return new Response(JSON.stringify({ success: true, redirectUrl: '/admin/login' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('ladakh_admin_token', { path: '/' });
  return redirect('/admin/login');
};
