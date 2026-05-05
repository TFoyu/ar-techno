/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow serving uploaded images
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
  // Required for file system access in API routes
  serverExternalPackages: ['mysql2', 'bcryptjs'],
};

export default nextConfig;
