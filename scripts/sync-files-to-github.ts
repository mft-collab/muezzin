import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { PAT, OWNER, REPO } from './lib/githubConfig.ts';

async function syncAllFiles() {

  const ignoreList = [
    'node_modules',
    '.git',
    '.firebase',
    'dist',
    'dev-dist',
    '.DS_Store',
    'package-lock.json'
  ];

  function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(function(file) {
      const fullPath = path.join(dirPath, file);
      const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

      if (ignoreList.some(ignore => relativePath.startsWith(ignore))) {
        return;
      }

      if (fs.statSync(fullPath).isDirectory()) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      } else {
        arrayOfFiles.push(relativePath);
      }
    });

    return arrayOfFiles;
  }

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  async function uploadFile(filePath: string, retryCount = 0): Promise<void> {
    const localPath = path.join(process.cwd(), filePath);
    const content = fs.readFileSync(localPath);
    const base64Content = content.toString('base64');

    try {
      // 1. Mevcut SHA'yı al
      const getRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=main`,
        {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${PAT}`,
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      let sha: string | undefined = undefined;
      if (getRes.ok) {
        const data = (await getRes.json()) as any;
        sha = data.sha;
      }

      // 2. Yükle veya Güncelle
      const putRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${PAT}`,
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: JSON.stringify({
            message: `Sync: ${filePath} (Update Node version and Fixes)`,
            content: base64Content,
            sha: sha,
            branch: 'main'
          })
        }
      );

      if (putRes.ok) {
        console.log(`[OK] ${filePath}`);
      } else {
        const errorData = (await putRes.json()) as any;
        
        // 409 Conflict hatası durumunda SHA değişmiş olabilir, tekrar dene
        if (putRes.status === 409 && retryCount < 3) {
          console.warn(`[CONFLICT] ${filePath} - Yeniden deneniyor (${retryCount + 1})...`);
          await sleep(1000);
          return uploadFile(filePath, retryCount + 1);
        }
        
        console.error(`[HATA] ${filePath} - Durum: ${putRes.status}`, errorData.message);
      }
    } catch (error) {
      console.error(`[KRİTİK] ${filePath}:`, error);
    }
  }

  console.log('--- SENKRONİZASYON BAŞLADI ---');
  const allFiles = getAllFiles(process.cwd());
  console.log(`${allFiles.length} dosya işleniyor...`);

  for (const filePath of allFiles) {
    await uploadFile(filePath);
    await sleep(200); // API limitlerine takılmamak için kısa bir bekleme
  }

  console.log('--- SENKRONİZASYON TAMAMLANDI ---');
}

syncAllFiles();
