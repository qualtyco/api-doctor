// Looks suspicious because it's a template literal containing TwiML XML
// tags, but there is no interpolated request data in it at all — a static
// string has nothing for an attacker-controlled value to break out of.
export function buildBusyTwiml(): string {
  return `
    <Response>
      <Say>Sorry, all agents are busy right now.</Say>
      <Hangup/>
    </Response>
  `;
}
