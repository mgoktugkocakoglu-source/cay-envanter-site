import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';

export type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * Vercel's Neon / Postgres integrations inject the standard libpq variables
 * (PGHOST, PGUSER…). Map them onto the API's DB_* names so a linked database
 * works without copying credentials; explicit DB_* values still win.
 */
function applyManagedPostgresEnv(env: NodeJS.ProcessEnv): void {
    if (!env.PGHOST) {
        return;
    }
    env.DB_HOST ??= env.PGHOST;
    env.DB_PORT ??= env.PGPORT ?? '5432';
    env.DB_USERNAME ??= env.PGUSER;
    env.DB_PASSWORD ??= env.PGPASSWORD;
    env.DB_DATABASE ??= env.PGDATABASE;
    env.DB_SSL ??= 'true';
}

/**
 * Serverless entry (Vercel function `api/index.js`): builds the Nest app once
 * per warm instance and hands back its Express handler instead of listening.
 */
export async function createRequestHandler(): Promise<RequestHandler> {
    applyManagedPostgresEnv(process.env);
    const app = await NestFactory.create(AppModule);
    configureApp(app);
    await app.init();
    return app.getHttpAdapter().getInstance() as RequestHandler;
}
