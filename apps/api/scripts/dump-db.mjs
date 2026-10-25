// Logical backup of the production database without pg_dump: every table in `public` as INSERT statements.
// Usage: node scripts/dump-db.mjs <url-file> <out.sql>
// Restore on the new host: let the API create the schema first (TypeORM synchronize), then `psql "$DATABASE_URL" -f out.sql`.
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const [urlFile, out] = process.argv.slice(2);
if (!urlFile || !out) throw new Error('usage: dump-db.mjs <url-file> <out.sql>');
const connectionString = readFileSync(urlFile, 'utf8').trim();
// Every value as its text representation, so the literal round-trips for any type (json, bytea, timestamps, arrays).
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, types: { getTypeParser: () => (v) => v } });
await client.connect();

const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")).rows.map((r) => r.tablename);
// standard_conforming_strings is on: only the quote needs doubling (bytea stays as \x…).
const literal = (v) => (v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const lines = [
    `-- cayhesabim logical backup ${new Date().toISOString()} (${tables.length} tables)`,
    '-- Restore after the schema exists: psql "$DATABASE_URL" -f this-file.sql',
    'SET session_replication_role = replica;',
    'BEGIN;',
];
const counts = {};
for (const table of tables) {
    const cols = (await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position', ['public', table])).rows.map((r) => r.column_name);
    const { rows } = await client.query({ text: `SELECT ${cols.map((c) => `"${c}"`).join(', ')} FROM "${table}"`, rowMode: 'array' });
    counts[table] = rows.length;
    lines.push(`\n-- ${table}: ${rows.length} rows`, `TRUNCATE "${table}" CASCADE;`);
    for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200).map((r) => `(${r.map(literal).join(', ')})`);
        lines.push(`INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES\n${chunk.join(',\n')};`);
    }
}
lines.push('COMMIT;', 'SET session_replication_role = DEFAULT;');
writeFileSync(out, lines.join('\n') + '\n');
await client.end();
console.log(JSON.stringify(counts, null, 1));
console.log(`→ ${out}`);
