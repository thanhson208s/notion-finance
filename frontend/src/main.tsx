const originalFetch = window.fetch;
async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const method = init?.method?.toUpperCase() ?? "GET";

  if (method === "POST") {
    const body = typeof init?.body === "string" ? init.body : "";
    const hash = await sha256Hex(body);

    const headers = new Headers(init?.headers || {});
    headers.set("x-amz-content-sha256", hash);

    return originalFetch(input, { ...init, headers });
  }

  return originalFetch(input, init);
};

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
