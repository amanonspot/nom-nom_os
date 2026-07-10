import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@nomnom/ui', '@nomnom/types'],
};

export default nextConfig;
