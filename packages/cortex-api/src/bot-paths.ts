/**
 * Path builders for Bot routes. Keep encoding in one place so a slug with a
 * slash cannot silently hit the wrong resource.
 */

export function mascotPath(id: string, suffix = ''): string {
  return `/v1/mascots/${encodeURIComponent(id)}${suffix}`;
}

export function skillPath(slug: string, suffix = ''): string {
  return `/v1/skills/${encodeURIComponent(slug)}${suffix}`;
}

export function withQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const encoded = params.toString();
  return encoded ? `${path}?${encoded}` : path;
}
