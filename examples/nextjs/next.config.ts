import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The widget package ships compiled ESM; transpiling it keeps Next happy across versions.
  transpilePackages: ['@sparrowdesk/react-chat'],
}

export default nextConfig
