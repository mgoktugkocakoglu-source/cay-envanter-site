import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

/**
 * HTTP pipeline shared by the long-running server (main.ts) and the
 * serverless entry (serverless.ts), so both expose the same API.
 */
export function configureApp(app: INestApplication): void {
    // Security
    app.use(helmet());

    // CORS
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });

    // Global prefix
    app.setGlobalPrefix('api');

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // Swagger documentation
    const config = new DocumentBuilder()
        .setTitle('Çay Üreticisi Platformu API')
        .setDescription('Authentication and user management API')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
}
