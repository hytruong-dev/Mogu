import 'dotenv/config';

async function testTavily() {
  const apiKey = process.env.TAVILY_API_KEY;
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: 'Bột gia vị bò kho',
      include_images: true,
      max_results: 3,
    }),
  });
  const json = await res.json() as any;
  console.log('Tavily response keys:', Object.keys(json));
  if (json.results) {
    console.log('Result sample:', json.results[0]);
  }
}

testTavily();
