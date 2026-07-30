import OpenAI from 'openai';

const client = new OpenAI();

// Distinct manifestation: indexOf + substring instead of lastIndexOf + slice.
// The brace-hunted string verifiably comes from a CUA response: it is the
// output_text of a computer-use-preview responses.create call.
export async function getStepMetadata(screenshotBase64: string) {
  const response = await client.responses.create({
    model: 'computer-use-preview',
    tools: [{ type: 'computer_use_preview', display_width: 1024, display_height: 768, environment: 'browser' }],
    input: [{ role: 'user', content: [{ type: 'input_image', image_url: `data:image/png;base64,${screenshotBase64}` }] }],
    truncation: 'auto',
  });

  const message = response.output_text;
  const braceStart = message.indexOf('{');
  const braceEnd = message.lastIndexOf('}') + 1;
  if (braceStart === -1 || braceEnd === 0) return null;
  return JSON.parse(message.substring(braceStart, braceEnd));
}
