import pg from 'pg';
import config from './index.js';

const { Pool } = pg;

const isSupabase = config.databaseUrl?.includes('supabase');

const pool = new Pool({
  connectionString: config.databaseUrl,
  // Supabase requires SSL; direct host may be IPv6-only on some networks
  ssl: isSupabase || config.isProduction ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

export const query = (text, params) => pool.query(text, params);

export const getClient = async () => {
  const client = await pool.connect();
  
  // Attach connection-level error listener to prevent process crashes if client experiences socket issues during checkout
  const errorHandler = (err) => {
    console.error('Database client socket connection error:', err);
  };
  client.on('error', errorHandler);
  
  // Override release to remove listener so we don't leak handlers across pool uses
  const originalRelease = client.release;
  client.release = (destroy) => {
    client.removeListener('error', errorHandler);
    return originalRelease.call(client, destroy);
  };
  
  return client;
};

export default pool;
