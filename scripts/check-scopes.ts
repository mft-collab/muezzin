import fetch from 'node-fetch';
import { PAT } from './lib/githubConfig.ts';

async function checkScopes() {
  
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    
    console.log('Scopes header:', response.headers.get('x-oauth-scopes'));
    console.log('Accepted scopes header:', response.headers.get('x-accepted-oauth-scopes'));
  } catch (e) { console.error(e); }
}

checkScopes();
