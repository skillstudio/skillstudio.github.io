import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { networkInterfaces } from "node:os";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const toolRoutes = [
  "compress",
  "pdf-to-image",
  "image-resize",
  "image-converter",
  "image-crop",
  "image-watermark",
];

function githubPagesRoutes() {
  return {
    name: "github-pages-routes",
    closeBundle() {
      const output = resolve("dist");
      for (const route of toolRoutes) {
        const directory = resolve(output, route);
        mkdirSync(directory, { recursive: true });
        copyFileSync(resolve(output, "index.html"), resolve(directory, "index.html"));
      }
    },
  };
}

function getLanAddress(): string {
  const addresses = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);

  return (
    addresses.find((address) => address.startsWith("192.168.")) ??
    addresses.find((address) => address.startsWith("10.")) ??
    addresses.find((address) => address.startsWith("172.")) ??
    addresses[0] ??
    "localhost"
  );
}

export default defineConfig({
  base: "/",
  define: {
    __DEV_LAN_HOST__: JSON.stringify(getLanAddress()),
  },
  plugins: [react(), githubPagesRoutes()],
});
