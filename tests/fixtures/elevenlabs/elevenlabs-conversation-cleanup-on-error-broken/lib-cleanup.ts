import type { Conversation } from '@11labs/client';

export function attachUnmountCleanup(conversation: Conversation): () => void {
  return () => {
    // Fire-and-forget on unmount — no try/catch around the cleanup call.
    conversation.endSession();
  };
}
