'use client';

import { useState } from 'react';

export function Widget() {
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<unknown>(null);

  async function startConversation() {
    setIsLoading(true);
    try {
      const session = await openSession();
      setConversation(session);
    } catch (error) {
      // Resets the conversation, but never the loading flag.
      setConversation(null);
      console.error(error);
    }
  }

  return <button onClick={startConversation}>{isLoading ? 'Loading...' : 'Start'}</button>;
}

declare function openSession(): Promise<unknown>;
