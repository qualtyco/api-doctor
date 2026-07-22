'use client';

import { useState } from 'react';

// Looks suspicious because the catch block itself never resets isLoading,
// but a finally block guarantees it runs on every exit path (success or
// failure), so the flag is always cleared correctly.
export function Widget() {
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<unknown>(null);

  async function startConversation() {
    setIsLoading(true);
    try {
      const session = await openSession();
      setConversation(session);
    } catch (error) {
      setConversation(null);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return <button onClick={startConversation}>{isLoading ? 'Loading...' : 'Start'}</button>;
}

declare function openSession(): Promise<unknown>;
