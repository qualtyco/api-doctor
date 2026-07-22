'use client';

import { useState } from 'react';

export function ConvAI() {
  const [isLoading, setIsLoading] = useState(false);

  async function startConversation() {
    setIsLoading(true);
    try {
      const signedUrl = await getSignedUrl('agent-1');
      await connect(signedUrl);
    } catch (error) {
      console.error('Error starting conversation:', error);
      setIsLoading(false);
      setConversation(null);
    }
  }

  function setConversation(_value: unknown) {}

  return <button onClick={startConversation}>{isLoading ? 'Loading...' : 'Start'}</button>;
}

declare function getSignedUrl(agentId: string): Promise<string>;
declare function connect(url: string): Promise<void>;
