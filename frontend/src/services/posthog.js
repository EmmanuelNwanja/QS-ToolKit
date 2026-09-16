import posthog from 'posthog-js';

if (typeof window !== 'undefined') {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

  if (key) {
    posthog.init(key, {
      api_host: host,
      capture_pageview: false, // We handle this manually
      capture_pageleave: true,
      autocapture: true,
      persistence: 'localStorage',
    });
  }
}

export default posthog;
