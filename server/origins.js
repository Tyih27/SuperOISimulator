function normalizeOrigin(value, variableName) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must contain valid HTTP(S) origins`);
  }

  if (!['http:', 'https:'].includes(url.protocol)
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash) {
    throw new Error(`${variableName} must contain HTTP(S) origins without paths, credentials, queries, or fragments`);
  }
  return url.origin;
}

export function parseAllowedOrigins(value, { variableName = 'APP_ORIGIN', fallback } = {}) {
  const rawOrigins = value === undefined ? [fallback] : value.split(',').map((origin) => origin.trim());
  if (rawOrigins.some((origin) => !origin)) {
    throw new Error(`${variableName} must be a comma-separated list of non-empty origins`);
  }
  return [...new Set(rawOrigins.map((origin) => normalizeOrigin(origin, variableName)))];
}
