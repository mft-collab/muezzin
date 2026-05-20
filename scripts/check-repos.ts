import fetch from 'node-fetch';
import { PAT, OWNER } from './lib/githubConfig.ts';

async function checkRepo() {
  const REPOS = ['muezzin', 'muezzin-takip'];

  for (const repo of REPOS) {
    console.log(`Checking ${OWNER}/${repo}...`);
    try {
      const response = await fetch(
        `https://api.github.com/repos/${OWNER}/${repo}`,
        {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${PAT}`,
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );
      if (response.ok) {
        console.log(`${repo} exists!`);
      } else {
        console.log(`${repo} NOT found. Status: ${response.status}`);
      }
    } catch (e) { console.error(e); }
  }
}

checkRepo();
