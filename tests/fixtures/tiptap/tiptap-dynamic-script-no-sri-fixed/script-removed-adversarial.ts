// Adversarial: script element created but never appended to DOM — should NOT fire
export function createButNeverInjectScript() {
  const script = document.createElement('script');
  script.src = 'https://cdn.example.com/lib.js';
  // Script is created and configured but never inserted into the DOM
  // No integrity needed since it's never injected
  return script;
}

export function preloadScript(url: string) {
  // Creates a link preload instead of injecting a script
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  link.as = 'script';
  document.head.appendChild(link);
}
