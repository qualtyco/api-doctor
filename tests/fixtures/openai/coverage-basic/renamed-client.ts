import { OpenAI as ModelGateway } from 'openai';

const client = new ModelGateway({ apiKey: process.env.OPENAI_API_KEY });

export async function summarize(text: string, customerId: string) {
  const response = await client.responses.create({
    model: 'gpt-5.2',
    input: `Summarize: ${text}`,
    safety_identifier: customerId,
  });
  return response.output_text;
}
