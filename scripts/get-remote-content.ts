import fetch from 'node-fetch';
import { PAT, OWNER, REPO } from './lib/githubConfig.ts';

async function getFileContent() {
  const FILE_PATH = '.github/workflows/haftalik_plan.yml';

  console.log(`Getting content of ${FILE_PATH} from ${OWNER}/${REPO}...`);

  try {
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${PAT}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (response.ok) {
      const data = (await response.json()) as any;
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      console.log('File Content:');
      console.log(content);
    } else {
      console.error(`Failed to get file. Status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

getFileContent();
