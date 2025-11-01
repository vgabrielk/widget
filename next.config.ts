import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Turbopack config removed to avoid build manifest issues
  
  // Performance optimizations
  experimental: {
    // Optimize production builds
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  
  // Enable React strict mode for better performance warnings
  reactStrictMode: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
