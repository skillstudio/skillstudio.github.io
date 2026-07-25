import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { networkInterfaces } from "node:os";

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
  base: "/imgskills/",
  define: {
    __DEV_LAN_HOST__: JSON.stringify(getLanAddress()),
  },
  plugins: [react()],
});
