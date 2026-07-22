'use client';

import { useEffect } from 'react';

export function ConvAI({ endConversation }: { endConversation: () => Promise<void> }) {
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
