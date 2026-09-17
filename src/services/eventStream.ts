import { apiUrl as sharedApiUrl } from './apiBase';
import { getAuthToken, isProductionApiEnabled } from './productionApi';

const apiUrl = (path: string) => sharedApiUrl(path);

/**
 * Near-real-time push over Server-Sent Events.
 *
 * Why fetch instead of EventSource: EventSource cannot send an Authorization
 * header, and we deliberately avoid cookie-based auth. We accept the same
 * limitation the Worker does — the JWT rides in `?token=` — but implement the
 * reader with fetch + ReadableStream so the connection supports automatic
 * reconnect with backoff, cancellation on logout, and a `ready` handshake.
 *
 * The Worker holds each response open for ~25 s and emits a `changed` event
 * the moment a relevant row changes; the reader here reconnects immediately
 * when the stream ends, so from the app's perspective changes arrive within
 * ~1-2 s continuously. All failures degrade silently: the caller keeps its
 * slow-poll fallback, so the worst case is the old 25-45 s latency.
 */

export type StreamKind = 'tickets' | 'notifications';

interface StreamHandlers {
  onTicketsChanged?: () => void;
  onNotificationsChanged?: () => void;
  onStatus?: (status: 'connecting' | 'open' | 'offline') => void;
}

const MAX_BACKOFF_MS = 30_000;

export function connectEventStream(kinds: StreamKind[], handlers: StreamHandlers): () => void {
  let controller: AbortController | null = null;
  let stopped = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms);
    });

  const connect = async () => {
    while (!stopped) {
      const token = getAuthToken();
      if (!token) {
        handlers.onStatus?.('offline');
        await wait(3000);
        continue;
      }

      controller = new AbortController();
      const params = new URLSearchParams({ kind: kinds.join(','), token });
      try {
        handlers.onStatus?.(attempt === 0 ? 'connecting' : 'connecting');
        const response = await fetch(apiUrl(`/api/events?${params.toString()}`), {
          headers: { Accept: 'text/event-stream' },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          // 401 etc — back off; the token may be refreshed by a re-login.
          throw new Error(`stream status ${response.status}`);
        }

        attempt = 0;
        handlers.onStatus?.('open');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Parse the SSE wire format: `event: <name>\ndata: <json>\n\n`.
        const handleChunk = (chunk: string) => {
          buffer += chunk;
          let separator = buffer.indexOf('\n\n');
          while (separator !== -1) {
            const rawEvent = buffer.slice(0, separator);
            buffer = buffer.slice(separator + 2);
            const lines = rawEvent.split('\n');
            const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim();
            const data = lines.find((l) => l.startsWith('data:'))?.slice(5).trim();
            if (event === 'changed' && data) {
              try {
                const parsed = JSON.parse(data) as { kind?: string };
                if (parsed.kind === 'tickets') handlers.onTicketsChanged?.();
                else if (parsed.kind === 'notifications') handlers.onNotificationsChanged?.();
              } catch { /* malformed event — ignore */ }
            } else if (event === 'ready') {
              handlers.onStatus?.('open');
            }
            separator = buffer.indexOf('\n\n');
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          handleChunk(decoder.decode(value, { stream: true }));
        }
        // Stream ended normally (Worker's ~25 s window) — reconnect promptly.
      } catch (error) {
        if (stopped || (error instanceof DOMException && error.name === 'AbortError')) break;
        attempt += 1;
        handlers.onStatus?.('offline');
        const backoff = Math.min(1000 * 2 ** Math.min(attempt, 5), MAX_BACKOFF_MS);
        await wait(backoff);
        continue;
      }

      if (stopped) break;
      // Immediate reconnect after a clean stream end; small jitter to spread
      // reconnect storms across clients.
      await wait(300 + Math.floor(Math.random() * 700));
    }
  };

  void connect();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    controller?.abort();
  };
}
