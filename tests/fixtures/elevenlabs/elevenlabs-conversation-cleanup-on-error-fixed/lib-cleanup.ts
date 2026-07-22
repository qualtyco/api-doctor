type Conversation = { endSession: () => Promise<void> };

// Looks suspicious because the try block's primary purpose is flushing
// pending audio buffers, not ending the conversation — but endSession() is
// still lexically inside it, so a rejection is actually caught.
export async function flushAndCleanup(conversation: Conversation, flushAudioBuffers: () => Promise<void>) {
  try {
    await flushAudioBuffers();
    await conversation.endSession();
  } catch (error) {
    console.error('Cleanup failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}
