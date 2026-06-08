/** @type {import('next').NextConfig} */
const nextConfig = {
  // API-only backend: no frontend pages. The App Router still requires a minimal
  // app/ directory, but all real surface lives under app/api/**.
  reactStrictMode: true,
};

export default nextConfig;
