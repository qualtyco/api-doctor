'use client';

import { useEffect } from 'react';
import type { Conversation } from '@11labs/client';

export function ConvAI({ endConversation }: { conversation: Conversation | null; endConversation: () => Promise<void> }) {
  useEffect(() => {
    const handleRecordingMessage = async (message: string) => {
      // No try/catch — if endConversation() rejects during a GL-mode
      // transition, the conversation state is never cleaned up.
      await endConversation();
      console.log('handled', message);
    };

    return () => {};
  }, [endConversation]);

  return null;
}
