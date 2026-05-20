import fetch from 'node-fetch';
import { PAT, OWNER, REPO } from './lib/githubConfig.ts';

async function triggerWorkflow() {
  const WORKFLOW_ID = process.argv[2] || 'aylik-ezan-takvimi.yml';

  console.log(`Triggering workflow ${WORKFLOW_ID} for ${OWNER}/${REPO}...`);

  try {
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${PAT}`,
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          ref: 'main'
        })
      }
    );

    if (response.status === 204) {
      console.log('Successfully triggered the workflow!');
    } else {
      const errorText = await response.text();
      console.error(`Failed to trigger workflow. Status: ${response.status}`);
      console.error(`Error details: ${errorText}`);
    }
  } catch (error) {
    console.error('An error occurred while triggering the workflow:', error);
  }
}

triggerWorkflow();
