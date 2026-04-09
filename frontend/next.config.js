const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..'),
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

module.exports = nextConfig;
