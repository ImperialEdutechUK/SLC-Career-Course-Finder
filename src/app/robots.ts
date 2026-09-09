import type { MetadataRoute } from 'next';

/** Personalised journeys, results and the API are never indexed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/guide/', '/api/'] }
  };
}
