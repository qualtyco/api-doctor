'use client';

import { useEffect } from 'react';

export function ConvAI({ endConversation }: { endConversation: () => Promise<void> }) {
  useEffect(() => {
    const handleRecordingMessage = async (message: string) => {
      try {
        await endConversation();
      } catch (error) {
        console.error('Failed to end conversation during GL mode transition:', error instanceof Error ? error.message : 'Unknown error');
      }
      console.log('handled', message);
    };

    return () => {};
  }, [endConversation]);

  return null;
}
