import { query } from './src/config/database.js';

async function test() {
  try {
    const users = await query("SELECT id, email, full_name FROM users");
    console.log(users.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

test();
