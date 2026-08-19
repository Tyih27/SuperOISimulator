export class ApiError extends Error {
  constructor(status, payload = null) {
    super(payload?.message ?? `API request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = payload?.code ?? null;
    this.payload = payload;
  }
}

async function readPayload(response) {
  if (response.status === 204) return null;
  const contentType = response.headers?.get?.("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  return response.json();
}

export async function api(path, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    body,
    headers = {},
    ...requestOptions
  } = options;
  if (typeof fetchImpl !== "function") throw new Error("A Fetch implementation is required");
  const response = await fetchImpl(`/api/v1${path}`, {
    credentials: "same-origin",
    ...requestOptions,
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await readPayload(response);
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload;
}

export function createApiClient({ fetchImpl = globalThis.fetch } = {}) {
  const request = (path, options = {}) => api(path, { ...options, fetchImpl });
  return Object.freeze({
    request,
    get: (path) => request(path),
    post: (path, body = {}) => request(path, { method: "POST", body }),
    put: (path, body) => request(path, { method: "PUT", body }),
    delete: (path, body = {}) => request(path, { method: "DELETE", body }),
  });
}
