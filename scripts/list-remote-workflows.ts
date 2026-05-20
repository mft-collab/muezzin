import fetch from 'node-fetch';
import { PAT, OWNER, REPO } from './lib/githubConfig.ts';

async function listFiles() {
  const PAT_FULL = PAT;
  const DIR = '.github/workflows';

  console.log(`Listing files in ${DIR} of ${OWNER}/${REPO}...`);

  try {
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DIR}`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${PAT_FULL}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (response.ok) {
      const data = (await response.json()) as any;
      console.log('Files found:', data.map((f: any) => f.name));
    } else {
      console.error(`Status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

listFiles();
