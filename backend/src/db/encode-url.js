/**
 * Build a Supabase DATABASE_URL with URL-encoded password.
 * Usage: node src/db/encode-url.js
 * (edit PROJECT_REF, REGION, PASSWORD below first)
 */
const PROJECT_REF = 'yrlztylcurwbeweukmdb';
const REGION = 'PASTE-FROM-SUPABASE-DASHBOARD'; // e.g. ap-south-1
const PASSWORD = '321@Jenil@123'; // your DB password

const encoded = encodeURIComponent(PASSWORD);

console.log('\n--- Copy ONE of these into backend/.env as DATABASE_URL ---\n');
console.log('Transaction pooler (recommended on Windows):');
console.log(
  `postgresql://postgres.${PROJECT_REF}:${encoded}@aws-0-${REGION}.pooler.supabase.com:6543/postgres`
);
console.log('\nSession pooler:');
console.log(
  `postgresql://postgres.${PROJECT_REF}:${encoded}@aws-0-${REGION}.pooler.supabase.com:5432/postgres`
);
