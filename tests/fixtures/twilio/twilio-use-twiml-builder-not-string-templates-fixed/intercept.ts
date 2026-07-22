import Twilio from 'twilio';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

export async function connectAgentLeg(
  twilio: ReturnType<typeof Twilio>,
  config: { TWILIO_CALLER_NUMBER: string; TWILIO_FLEX_NUMBER: string; NGROK_DOMAIN: string },
  customParameters: { from: string },
  callSid: string,
) {
  const agentTwiml = new VoiceResponse();
  agentTwiml.say('A customer is on the line.');
  const connect = agentTwiml.connect();
  const stream = connect.stream({
    name: 'Outbound Audio Stream',
    url: `wss://${config.NGROK_DOMAIN}/intercept`,
  });
  stream.parameter({ name: 'callSid', value: callSid });
  stream.parameter({ name: 'from', value: customParameters.from });

  await twilio.calls.create({
    from: config.TWILIO_CALLER_NUMBER,
    to: config.TWILIO_FLEX_NUMBER,
    twiml: agentTwiml.toString(),
  });
}
