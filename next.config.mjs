import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the project root so a stray lockfile in a parent folder is ignored.
  outputFileTracingRoot: root,
  turbopack: { root },
  serverExternalPackages: ["@electric-sql/pglite", "pg", "unpdf", "exceljs"],
};
export default nextConfig;
