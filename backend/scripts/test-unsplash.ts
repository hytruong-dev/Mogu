import 'dotenv/config';

async function testUnsplash() {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  const res = await fetch('https://api.unsplash.com/search/photos?query=cinnamon%20stick&per_page=1', {
    headers: { 'Authorization': 'Client-ID ' + key },
  });
  const data = await res.json() as any;
  console.log('Unsplash result:', data.results?.[0]?.urls?.small);
}

testUnsplash();
