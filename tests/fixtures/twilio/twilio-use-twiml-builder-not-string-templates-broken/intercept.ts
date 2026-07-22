import Twilio from 'twilio';

export async function connectAgentLeg(
  twilio: ReturnType<typeof Twilio>,
  config: { TWILIO_CALLER_NUMBER: string; TWILIO_FLEX_NUMBER: string; NGROK_DOMAIN: string },
  customParameters: { from: string },
  callSid: string,
) {
  await twilio.calls.create({
    from: config.TWILIO_CALLER_NUMBER,
    to: config.TWILIO_FLEX_NUMBER,
    twiml: `
      <Response>
        <Say>A customer is on the line.</Say>
        <Connect>
          <Stream name="Outbound Audio Stream" url="wss://${config.NGROK_DOMAIN}/intercept">
            <Parameter name="callSid" value="${callSid}"/>
            <Parameter name="from" value="${customParameters.from}"/>
          </Stream>
        </Connect>
      </Response>
    `,
  });
}
