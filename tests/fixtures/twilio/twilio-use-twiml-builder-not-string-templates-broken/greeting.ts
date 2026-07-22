export function buildGreetingTwiml(callerName: string): string {
  return `<Response><Say>Hello ${callerName}, thanks for calling.</Say></Response>`;
}
