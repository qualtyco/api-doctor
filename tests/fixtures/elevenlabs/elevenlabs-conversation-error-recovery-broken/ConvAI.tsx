'use client';

import { useState } from 'react';
import { getSignedUrl } from './lib/elevenlabs';

export function ConvAI() {
  const [isLoading, setIsLoading] = useState(false);

  async function startConversation() {
    setIsLoading(true);
    try {
      const signedUrl = await getSignedUrl('agent-1');
      await connect(signedUrl);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  }

  return <button onClick={startConversation}>{isLoading ? 'Loading...' : 'Start'}</button>;
}

declare function connect(url: string): Promise<void>;
