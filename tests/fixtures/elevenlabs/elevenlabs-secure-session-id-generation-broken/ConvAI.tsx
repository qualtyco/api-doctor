'use client';

import { useState } from 'react';

export function ConvAI() {
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  return <div data-session={sessionId} />;
}
