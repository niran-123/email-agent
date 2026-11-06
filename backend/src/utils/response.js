// backend/src/utils/response.js
// Helpers for consistent JSON API responses.

/**
 * Send a successful JSON response.
 * @param {import('express').Response} res
 * @param {*} data
 * @param {string} [message]
 * @param {number} [statusCode]
 */
export function sendSuccess(res, data, message = 'Success', statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Send a paginated JSON response.
 * @param {import('express').Response} res
 * @param {Array} items
 * @param {{ total: number, page: number, limit: number }} meta
 */
export function sendPaginated(res, items, meta) {
  res.status(200).json({
    success: true,
    data: items,
    pagination: {
      total: meta.total,
      page: meta.page,
      limit: meta.limit,
      totalPages: Math.ceil(meta.total / meta.limit),
    },
  });
}

