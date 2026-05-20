import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { PAT, OWNER, REPO } from './lib/githubConfig.ts';

async function pushFile() {
  const FILE_PATH = '.github/workflows/aylik-ezan-takvimi.yml';
  
  const content = fs.readFileSync(path.join(process.cwd(), FILE_PATH), 'utf8');
  const base64Content = Buffer.from(content).toString('base64');

  console.log(`Pushing ${FILE_PATH} to ${OWNER}/${REPO}...`);

  try {
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
      {
        method: 'PUT',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${PAT}`,
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          message: 'Add monthly calendar workflow',
          content: base64Content,
          branch: 'main'
        })
      }
    );

    if (response.ok) {
      console.log('Successfully pushed the file!');
    } else {
      const errorText = await response.text();
      console.error(`Failed to push file. Status: ${response.status}`);
      console.error(`Error details: ${errorText}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

pushFile();
