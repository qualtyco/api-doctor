type Conversation = { endSession: () => Promise<void> };

export function attachUnmountCleanup(conversation: Conversation): () => void {
  return () => {
    // Fire-and-forget on unmount — no try/catch around the cleanup call.
    conversation.endSession();
  };
}
