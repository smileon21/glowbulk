// Shared display formatters.

// "lisa sibanda" -> "Lisa Sibanda", "mary-jane o'neil" -> "Mary-Jane O'Neil"
export function formatName(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/(^|[\s\-'])(\p{L})/gu, (match, sep, letter) => sep + letter.toUpperCase());
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
