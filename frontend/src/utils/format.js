// frontend/src/utils/format.js
// Shared formatting helpers.

/**
 * Format a date to a localised string.
 * @param {string|Date} date
 * @param {Intl.DateTimeFormatOptions} [options]
 */
export function formatDate(date, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(date));
}

/**
 * Truncate text to a max length.
 * @param {string} str
 * @param {number} [max]
 */
export function truncate(str, max = 80) {
  if (!str) return '';
  return str.length <= max ? str : str.slice(0, max).trimEnd() + '…';
}

/**
 * Capitalise first letter of a string.
 */
export function capitalise(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

