// Must stay first: maps PG* onto DB_* before AppModule validates the environment.
import '@/managed-postgres-env';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';

export type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * Serverless entry (Vercel function `api/index.js`): builds the Nest app once
 * per warm instance and hands back its Express handler instead of listening.
 */
export async function createRequestHandler(): Promise<RequestHandler> {
    const app = await NestFactory.create(AppModule);
    configureApp(app);
    await app.init();
    return app.getHttpAdapter().getInstance() as RequestHandler;
}
