import fetch from 'node-fetch';
import { PAT, OWNER, REPO } from './lib/githubConfig.ts';

async function checkFile() {
  const FILE_PATH = '.github/workflows/aylik-ezan-takvimi.yml';

  console.log(`Checking for file ${FILE_PATH} in ${OWNER}/${REPO}...`);

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
      console.log('File exists!');
    } else {
      console.log(`File NOT found. Status: ${response.status}`);
      
      // Try with underscore
      const FILE_PATH_UNDERSCORE = '.github/workflows/aylik_ezan_takvimi.yml';
      console.log(`Checking for file ${FILE_PATH_UNDERSCORE}...`);
      const response2 = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH_UNDERSCORE}`,
        {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${PAT}`,
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );
      if (response2.ok) {
        console.log('File (underscore version) exists!');
      } else {
        console.log(`File (underscore version) NOT found either. Status: ${response2.status}`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkFile();
