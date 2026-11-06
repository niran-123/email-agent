// frontend/src/utils/clsx.js
// Minimal class name utility (like clsx but zero-dep).

/**
 * Merge conditional Tailwind class strings.
 * @param {...(string|boolean|null|undefined)} classes
 * @returns {string}
 */
export function clsx(...classes) {
  return classes.filter(Boolean).join(' ');
}

