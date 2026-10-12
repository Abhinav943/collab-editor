import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  transpilePackages: ["monaco-editor", "y-monaco"],
  webpack: (config) => {
    config.resolve.alias["monaco-editor"] = path.resolve(
      dirname,
      "node_modules/monaco-editor",
    );
    return config;
  },
};

export default nextConfig;
