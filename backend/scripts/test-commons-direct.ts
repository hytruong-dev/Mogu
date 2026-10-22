async function testFetchCommons(title: string) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': 'MoguBot/1.0 (contact@mogu.vn)' } });
  const json = await res.json() as any;
  const p = Object.values(json.query.pages)[0] as any;
  const thumbUrl = p.imageinfo?.[0]?.thumburl;
  console.log(title, 'thumburl:', thumbUrl);
  if (thumbUrl) {
    const imgRes = await fetch(thumbUrl, { headers: { 'User-Agent': 'MoguBot/1.0 (contact@mogu.vn)' } });
    console.log('Download status:', imgRes.status, 'size:', (await imgRes.arrayBuffer()).byteLength);
  }
}

async function run() {
  await testFetchCommons('File:Tahu digoreng.JPG');
  await testFetchCommons('File:Giò lụa 2.jpg');
  await testFetchCommons('File:Cha gio.jpg');
  await testFetchCommons('File:Nem chua.jpg');
}

run();
