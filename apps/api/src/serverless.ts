// Must stay first: maps PG* onto DB_* before AppModule validates the environment.
import '@/managed-postgres-env';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';

export type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * Serverless entry (Vercel function `api/index.js`): builds the Nest app once
 * per warm instance and hands back its Express handler instead of listening.
 */
export async function createRequestHandler(): Promise<RequestHandler> {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    // Behind Vercel's edge every socket comes from the platform proxy; trust its
    // X-Forwarded-For so req.ip (and the throttler's per-client buckets) is the
    // real visitor instead of one address shared by everybody.
    app.set('trust proxy', true);
    configureApp(app);
    await app.init();
    return app.getHttpAdapter().getInstance() as RequestHandler;
}
