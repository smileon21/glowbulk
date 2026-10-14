// Shared display formatters.

// "lisa sibanda" -> "Lisa Sibanda", "mary-jane o'neil" -> "Mary-Jane O'Neil"
export function formatName(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (match, sep, letter) => sep + letter.toUpperCase());
}

// "5m ago", "3h ago", "2d ago"; older than a week falls back to the date
export function formatTimeAgo(value) {
  if (!value) return '';
  const date = new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
  return formatDate(value);
}

// "2026-10-08T09:30:00Z" -> "8 Oct 2026" (unambiguous, unlike 10/8/2026)
export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
