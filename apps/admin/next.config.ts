import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Consume shared TS packages directly from source.
  transpilePackages: ['@nomnom/ui', '@nomnom/types'],
};

export default nextConfig;
