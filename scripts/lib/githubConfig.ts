import dotenv from 'dotenv';
import path from 'path';

// Load .env file from the root directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const PAT = process.env.GITHUB_PAT || '';
export const OWNER = 'mft-collab';
export const REPO = 'muezzin';
