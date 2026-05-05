import fs from 'fs';
import https from 'https';

async function download(url: string, dest: string) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

(async () => {
  await download('https://placehold.co/192x192/1B3A5C/ffffff.png?text=M', 'public/pwa-192x192.png');
  await download('https://placehold.co/512x512/1B3A5C/ffffff.png?text=M', 'public/pwa-512x512.png');
  console.log('Downloaded PWA icons successfully.');
})();
