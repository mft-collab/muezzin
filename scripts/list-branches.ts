import fetch from 'node-fetch';
import { PAT, OWNER, REPO } from './lib/githubConfig.ts';

async function listBranches() {

  console.log(`Listing branches for ${OWNER}/${REPO}...`);

  try {
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/branches`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${PAT}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log('Branches found:', JSON.stringify(data, null, 2));
    } else {
      console.error(`Status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

listBranches();
