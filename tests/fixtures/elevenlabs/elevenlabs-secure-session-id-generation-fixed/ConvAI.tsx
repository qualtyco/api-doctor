'use client';

import { useState } from 'react';

export function ConvAI() {
  const [sessionId] = useState(() => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return 'session_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  });

  return <div data-session={sessionId} />;
}
