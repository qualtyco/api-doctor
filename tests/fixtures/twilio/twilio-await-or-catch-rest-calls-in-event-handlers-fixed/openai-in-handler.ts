import StreamSocket, { StartBaseAudioMessage } from '@/services/StreamSocket';

// Looks suspicious because it's the same "await <client>.x.create() with no
// try/catch inside an event handler" shape, but `openai` is not a Twilio
// REST client — out of scope for this Twilio-specific rule.
export function registerStartHandler(ss: StreamSocket, openai: { chat: { completions: { create: (args: unknown) => Promise<unknown> } } }) {
  ss.onStart(async (message: StartBaseAudioMessage) => {
    await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [] });
  });
}
