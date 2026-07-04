export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'item';
}

export async function generateUniqueSlug(
  baseValue: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const baseSlug = slugify(baseValue);
  let candidate = baseSlug;
  let suffix = 2;

  while (await isTaken(candidate)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}
