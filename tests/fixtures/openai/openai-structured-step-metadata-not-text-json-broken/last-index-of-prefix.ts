import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// lastIndexOf + slice variant, with the sliced string derived from the CUA
// response through an intermediate variable rather than parsed inline.
export async function nextStep(previousCallId: string, screenshot: string) {
  const response = await openai.responses.create({
    model: 'computer-use-preview',
    tools: [{ type: 'computer_use_preview', display_width: 1280, display_height: 800, environment: 'browser' }],
    input: [
      {
        type: 'computer_call_output',
        call_id: previousCallId,
        output: { type: 'input_image', image_url: `data:image/png;base64,${screenshot}` },
      },
    ],
    truncation: 'auto',
  });

  const raw = response.output_text;
  const start = raw.lastIndexOf('{"simplified":');
  if (start === -1) return null;
  const end = raw.length;
  try {
    return JSON.parse(raw.slice(start, end)) as { simplified: string; thought: string };
  } catch {
    return null;
  }
}
