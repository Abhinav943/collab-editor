import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["monaco-editor", "y-monaco"],
  webpack: (config) => {
    // y-monaco deep-imports monaco's ESM entry. Point the specifier at the real
    // folder so package "exports" restrictions can't block resolution.
    config.resolve.alias["monaco-editor"] = path.resolve(
      dirname,
      "node_modules/monaco-editor",
    );
    return config;
  },
};

export default nextConfig;
