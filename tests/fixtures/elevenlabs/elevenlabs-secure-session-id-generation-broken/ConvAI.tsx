'use client';

import { useState } from 'react';
import { useConversation } from '@11labs/react';

export function ConvAI() {
  const conversation = useConversation();
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  return <div data-session={sessionId} data-status={conversation.status} />;
}
