// Cloudflare's current DOM lib types Response.json() as unknown. The client
// services validate response status at the boundary and then use typed payloads.
interface Body {
  json<T = any>(): Promise<T>;
}
