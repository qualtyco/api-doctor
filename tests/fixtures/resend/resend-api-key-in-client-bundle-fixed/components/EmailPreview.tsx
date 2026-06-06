import type { CreateEmailOptions } from 'resend';

// Adversarial: under components/ and renders JSX, but only imports a TYPE from
// resend. Type imports are erased at build time, so no key reaches the client.
export function EmailPreview({ options }: { options: CreateEmailOptions }) {
  return (
    <div>
      <h1>{options.subject}</h1>
      <p>To: {String(options.to)}</p>
    </div>
  );
}
