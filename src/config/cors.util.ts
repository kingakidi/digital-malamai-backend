export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/** True for http(s)://localhost or 127.0.0.1 with any port. */
export function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  allowed: string[],
  options?: { allowLocalDev?: boolean },
): boolean {
  if (!origin) {
    return true;
  }

  if (allowed.includes(origin)) {
    return true;
  }

  if (options?.allowLocalDev && isLocalDevOrigin(origin)) {
    return true;
  }

  return false;
}
