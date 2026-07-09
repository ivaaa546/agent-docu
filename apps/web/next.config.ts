import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  proxyTimeout: 300000, // 5 minutos de timeout para subida de archivos grandes por proxy
  experimental: {
    proxyTimeout: 300000,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:3001/:path*',
      },
    ];
  },
};

export default nextConfig;
