if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "development",
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        new Sentry.BrowserTracing(),
      ],
      beforeSend(event) {
        // Filter out non-error events in development
        if (process.env.NODE_ENV === "development" && event.level !== "error") {
          return null;
        }
        return event;
      },
    });
  });
}
