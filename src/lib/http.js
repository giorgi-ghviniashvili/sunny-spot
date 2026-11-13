/** Tiny JSON-over-fetch client with an optional timeout. */
export class HttpClient {
  async getJSON(url, { timeoutMs } = {}) {
    const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`${new URL(url).host} responded ${response.status}`);
    return response.json();
  }
}
