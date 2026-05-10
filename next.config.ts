import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Auth Mock Rewrites
      {
        source: '/auth/v1/signup',
        destination: '/api/auth-mock/signup',
      },
      {
        source: '/auth/v1/token',
        destination: '/api/auth-mock/login',
      },
      {
        source: '/auth/v1/user',
        destination: '/api/auth-mock/user',
      },
      // PostgREST Proxy
      {
        source: '/rest/v1/:path*',
        destination: 'http://localhost:3002/:path*',
      },
    ];
  },
};

export default nextConfig;
