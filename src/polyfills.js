/**
 * Polyfill for navigator.userAgentData to prevent Headless UI from crashing in browsers
 * like Safari and Firefox that do not yet support the User-Agent Client Hints API.
 */
if (typeof window !== 'undefined' && window.navigator && !window.navigator.userAgentData) {
  window.navigator.userAgentData = {
    brands: [],
    mobile: /Mobi|Android/i.test(window.navigator.userAgent),
    getHighEntropyValues: () => Promise.resolve({}),
  };
}
