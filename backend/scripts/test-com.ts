async function checkCom() {
  const url = 'http://www.comvonghanoi.com/2014/01/cac-thuong-thuc-com-lang-vong.html';
  const res = await fetch(url);
  const text = await res.text();
  const imgs = Array.from(text.matchAll(/https?:\/\/[^"'<>\s]+\.(jpg|jpeg|png|webp)/gi)).map(m => m[0]);
  console.log('Found:', imgs);
}
checkCom();
