import fetch from 'node-fetch';
import { PAT, OWNER, REPO } from './lib/githubConfig.ts';

async function listWorkflows() {

  console.log(`Listing workflows for ${OWNER}/${REPO}...`);

  try {
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows`,
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
      console.log('Workflows found:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.error(`Failed to list workflows. Status: ${response.status}`);
      console.error(`Error details: ${errorText}`);
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

listWorkflows();
