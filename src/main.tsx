import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

document.documentElement.classList.add("dark");

const rootEl = document.getElementById("app");
if (!rootEl) {
  throw new Error("#app not found");
}
const appRoot = rootEl;

function showFatal(message: string) {
  appRoot.innerHTML = `<pre class="m-0 rounded-lg border border-red-900 bg-card p-4 font-mono text-base text-red-300 whitespace-pre-wrap break-words">${message.replace(/</g, "&lt;")}</pre>`;
}

try {
  createRoot(appRoot).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (err) {
  const msg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ""}` : String(err);
  showFatal(msg);
  console.error(err);
}
