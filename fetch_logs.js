const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const res = await pool.query("SELECT payload FROM \"WebhookLog\" WHERE direction = 'INBOUND' ORDER BY \"createdAt\" DESC LIMIT 5");
        console.log("LAST 5 INBOUND WEBHOOKS:");
        res.rows.forEach((r, i) => {
           console.log(`\n--- WEBHOOK ${i+1} ---`);
           console.log(r.payload);
        });
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
