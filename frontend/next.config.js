/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Use INTERNAL_API_URL (server-side, never baked into JS bundle).
    // In Docker:    set to http://backend:8000 in docker-compose environment.
    // In local dev: falls back to http://localhost:8000.
    const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;