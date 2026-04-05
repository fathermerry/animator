import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Absolute path to `src/` — robust across OS and when the config file moves. */
const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  root: ".",
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": srcDir,
    },
  },
});
