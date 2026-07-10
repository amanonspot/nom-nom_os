import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@nomnom/ui',
    '@nomnom/types',
    '@nomnom/sync-client',
    '@nomnom/persistence-idb',
  ],
};

export default nextConfig;
