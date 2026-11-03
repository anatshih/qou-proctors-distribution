/**
 * Canonical sorting function for Proctors across the QOU proctoring platform:
 * 1. Category: Academics ('academic') first, then Administrative ('administrative') second.
 * 2. Alphabetical (Arabic) collation within each category.
 */
export function sortProctors(proctors) {
  if (!Array.isArray(proctors)) return [];
  return [...proctors].sort((a, b) => {
    const typeA = (a.type || 'academic') === 'academic' ? 0 : 1;
    const typeB = (b.type || 'academic') === 'academic' ? 0 : 1;
    if (typeA !== typeB) return typeA - typeB;
    return (a.name || '').localeCompare(b.name || '', 'ar', { sensitivity: 'base' });
  });
}
