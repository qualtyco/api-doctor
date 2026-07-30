// Analytics loader that injects a third-party script without SRI
export function loadAnalyticsScript(trackingId: string) {
  const script = document.createElement('script');
  script.src = `https://cdn.analytics-provider.com/track.js?id=${trackingId}`;
  script.defer = true;
  script.dataset.page = 'tiptap-editor';
  // Appended without setting integrity attribute
  document.head.appendChild(script);
}

loadAnalyticsScript(process.env.NEXT_PUBLIC_ANALYTICS_ID ?? '');
