const { Client } = require('pg');


async function run() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
    });
    
    await client.connect();
    
    try {
        await client.query('DROP TABLE IF EXISTS job_listings CASCADE;');
        await client.query('DROP TABLE IF EXISTS community_comments CASCADE;');
        await client.query('DROP TABLE IF EXISTS community_reactions CASCADE;');
        await client.query('DROP TABLE IF EXISTS community_posts CASCADE;');
        await client.query('DROP TABLE IF EXISTS community_tags CASCADE;');
        console.log('Tables dropped successfully.');
    } catch (e) {
        console.error('Error dropping tables:', e);
    } finally {
        await client.end();
    }
}

run();
