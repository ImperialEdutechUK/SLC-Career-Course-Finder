/** @type {import('next').NextConfig} */

// React's development build needs eval() to rebuild call stacks for its debugging
// overlay. Production never uses it, so the allowance is scoped to `next dev` only and
// the header shipped to learners stays as strict as it was.
const isDev = process.env.NODE_ENV === 'development';
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'"
    ].join('; ')
  }
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Lambda needs a self-contained server bundle rather than the whole node_modules tree.
  output: 'standalone',

  // The catalogue is read from disk at request time with a path built at runtime, so
  // Next's tracing cannot infer it. Without this the standalone bundle ships without a
  // release, /api/v1/health/ready answers 503 and the deployment fails closed.
  outputFileTracingIncludes: {
    '/**': ['./data/generated/**']
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Personalised journeys and results must never be cached or indexed.
      {
        source: '/guide/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
        ]
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
        ]
      }
    ];
  }
};

export default nextConfig;
