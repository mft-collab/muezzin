import fetch from 'node-fetch';
import { PAT, OWNER, REPO } from './lib/githubConfig.ts';

async function listSecrets() {

  console.log(`Listing secrets for ${OWNER}/${REPO}...`);

  try {
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/secrets`,
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
      console.log('Secrets found:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.error(`Status: ${response.status}, Error: ${errorText}`);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

listSecrets();
