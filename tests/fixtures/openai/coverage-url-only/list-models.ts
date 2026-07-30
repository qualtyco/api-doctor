export async function listModelsRaw() {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  });
  return res.json();
}
