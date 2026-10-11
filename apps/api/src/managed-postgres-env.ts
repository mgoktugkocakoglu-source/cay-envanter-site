/**
 * Vercel's Neon / Postgres integrations inject the standard libpq variables
 * (PGHOST, PGUSER…). Map them onto the API's DB_* names so a linked database
 * works without copying credentials; explicit DB_* values still win.
 *
 * Side-effect module: it must be imported before AppModule, because
 * ConfigModule.forRoot validates the environment as soon as app.module loads.
 */
const env = process.env;

if (env.PGHOST) {
    env.DB_HOST ??= env.PGHOST;
    env.DB_PORT ??= env.PGPORT ?? '5432';
    env.DB_USERNAME ??= env.PGUSER;
    env.DB_PASSWORD ??= env.PGPASSWORD;
    env.DB_DATABASE ??= env.PGDATABASE;
    env.DB_SSL ??= 'true';
}
