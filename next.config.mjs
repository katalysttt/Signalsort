/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "unpdf", "xlsx"],
};
export default nextConfig;
