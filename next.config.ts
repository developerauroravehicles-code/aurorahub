import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',

  async redirects() {
    return [
      // Old system-management -> new structure (backward compatibility)
      { source: '/dashboard/system-management', destination: '/dashboard/identity', permanent: true },
      { source: '/dashboard/system-management/identity', destination: '/dashboard/identity', permanent: true },
      { source: '/dashboard/system-management/user', destination: '/dashboard/identity/users', permanent: true },
      { source: '/dashboard/system-management/groups', destination: '/dashboard/identity/groups', permanent: true },
      { source: '/dashboard/system-management/roles', destination: '/dashboard/identity/roles', permanent: true },
      { source: '/dashboard/system-management/permissions', destination: '/dashboard/identity/permissions', permanent: true },
      { source: '/dashboard/system-management/sessions', destination: '/dashboard/identity/sessions', permanent: true },
      { source: '/dashboard/system-management/database', destination: '/dashboard/infrastructure/database', permanent: true },
      { source: '/dashboard/system-management/api', destination: '/dashboard/integrations/external-apis', permanent: true },
      { source: '/dashboard/infrastructure/api', destination: '/dashboard/integrations/external-apis', permanent: true },
      { source: '/dashboard/system-management/automation', destination: '/dashboard/infrastructure/automation', permanent: true },
      { source: '/dashboard/system-management/mail-settings', destination: '/dashboard/infrastructure/mail', permanent: true },
      { source: '/dashboard/system-management/sms', destination: '/dashboard/infrastructure/sms', permanent: true },
      { source: '/dashboard/system-management/webhooks', destination: '/dashboard/integrations/webhooks', permanent: true },
      { source: '/dashboard/system-management/external-apis', destination: '/dashboard/integrations/external-apis', permanent: true },
      { source: '/dashboard/system-management/third-party', destination: '/dashboard/integrations/third-party', permanent: true },
      { source: '/dashboard/system-management/logs', destination: '/dashboard/observability/logs', permanent: true },
      { source: '/dashboard/system-management/monitoring', destination: '/dashboard/observability/monitoring', permanent: true },
      { source: '/dashboard/system-management/alerts', destination: '/dashboard/observability/alerts', permanent: true },
      { source: '/dashboard/system-management/service-desk', destination: '/dashboard/operations/service-desk', permanent: true },
      { source: '/dashboard/system-management/tasks', destination: '/dashboard/operations/tasks', permanent: true },
      { source: '/dashboard/system-management/logo', destination: '/dashboard/configuration/branding', permanent: true },
      { source: '/dashboard/system-management/whitepaper', destination: '/dashboard/configuration/documents', permanent: true },
      { source: '/dashboard/system-management/settings', destination: '/dashboard/configuration/settings', permanent: true },
      { source: '/dashboard/system-management/dealer', destination: '/dashboard/configuration/dealers', permanent: true },
      { source: '/dashboard/system-management/region', destination: '/dashboard/configuration/region', permanent: true },
      { source: '/dashboard/system-management/calendar', destination: '/dashboard/configuration/calendar', permanent: true },
      { source: '/dashboard/system-management/cameras', destination: '/dashboard/configuration/cameras', permanent: true },
    ]
  },
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  
  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  
  // Bundle analyzer
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config: any) => {
      const { BundleAnalyzerPlugin } = require('@next/bundle-analyzer')({
        enabled: true,
      });
      config.plugins.push(new BundleAnalyzerPlugin());
      return config;
    },
  }),
};

export default nextConfig;
