declare function getBrowserProvider(name: string): { requestStop(sessionId: string, projectId: string): Promise<void> };

export async function endSetupLoginSession(sessionId: string, projectId: string) {
  await getBrowserProvider('browserbase').requestStop(sessionId, projectId);
}
