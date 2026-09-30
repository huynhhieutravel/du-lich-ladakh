import type { APIRoute, APIContext } from 'astro';

export type ApiResponse<T = any> = {
  success: true;
  data?: T;
  message?: string;
} | {
  success: false;
  error: {
    message: string;
    code: string;
    details?: any;
  };
};

export function apiSuccess<T>(data?: T, status = 200, message?: string): Response {
  return new Response(
    JSON.stringify({ success: true, data, message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

export function apiError(message: string, status = 500, code = 'INTERNAL_ERROR', details?: any): Response {
  return new Response(
    JSON.stringify({ success: false, error: { message, code, details } }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * A wrapper to catch unhandled errors and format them into the standard API response.
 * Prevents the Cloudflare Worker from crashing on uncaught exceptions.
 */
// Translate raw D1/SQLite errors to user-friendly Vietnamese messages
function translateDbError(errorMsg: string): string {
  if (errorMsg.includes('NOT NULL constraint failed: Post.categoryId')) {
    return 'Vui lòng chọn ít nhất 1 danh mục cho bài viết.';
  }
  if (errorMsg.includes('NOT NULL constraint failed')) {
    const match = errorMsg.match(/NOT NULL constraint failed: (\w+)\.(\w+)/);
    const field = match?.[2] || 'unknown';
    return `Trường "${field}" không được để trống.`;
  }
  if (errorMsg.includes('UNIQUE constraint failed')) {
    return 'Dữ liệu bị trùng lặp. Vui lòng kiểm tra lại đường dẫn hoặc tiêu đề.';
  }
  if (errorMsg.includes('FOREIGN KEY constraint failed')) {
    return 'Dữ liệu tham chiếu không hợp lệ. Vui lòng kiểm tra danh mục, tác giả hoặc tags.';
  }
  if (errorMsg.includes('SQLITE_MISMATCH')) {
    return 'Kiểu dữ liệu không khớp. Vui lòng liên hệ quản trị viên.';
  }
  if (errorMsg.includes('D1_ERROR')) {
    return 'Lỗi cơ sở dữ liệu. Vui lòng thử lại sau.';
  }
  return errorMsg;
}

export function withErrorHandler(handler: (context: APIContext) => Promise<Response> | Response): APIRoute {
  return async (context: APIContext) => {
    try {
      return await handler(context);
    } catch (error: any) {
      console.error(`[API Error] ${context.request.url}:`, error);
      const friendlyMessage = translateDbError(error.message || 'Lỗi hệ thống không mong muốn');
      return apiError(
        friendlyMessage,
        500,
        'UNHANDLED_EXCEPTION'
      );
    }
  };
}
