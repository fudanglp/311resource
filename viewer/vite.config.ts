import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const viewerDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(viewerDir, "..");

export default defineConfig({
  plugins: [react()],
  define: {
    __REPO_ROOT__: JSON.stringify(repoRoot)
  },
  server: {
    fs: {
      allow: [repoRoot]
    }
  }
});
