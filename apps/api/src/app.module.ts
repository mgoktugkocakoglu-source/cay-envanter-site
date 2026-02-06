import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
import { AuthModule } from '@/auth/auth.module';
import { UsersModule } from '@/users/users.module';
import { MailModule } from '@/mail/mail.module';
import { GeoModule } from '@/geo/geo.module';
import { FieldsModule } from '@/fields/fields.module';
import { HarvestsModule } from '@/harvests/harvests.module';
import { PaymentsModule } from '@/payments/payments.module';
import { ReportsModule } from '@/reports/reports.module';
import { ForumModule } from '@/forum/forum.module';

@Module({
    imports: [
        // Rate limiting
        ThrottlerModule.forRoot([{
            ttl: 60000, // 60 seconds
            limit: 30, // 30 requests per minute default
        }]),

        // Environment configuration with validation
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema: Joi.object({
                NODE_ENV: Joi.string()
                    .valid('development', 'production', 'test')
                    .default('development'),
                PORT: Joi.number().default(3000),
                DB_HOST: Joi.string().required(),
                DB_PORT: Joi.number().default(5432),
                DB_USERNAME: Joi.string().required(),
                DB_PASSWORD: Joi.string().required(),
                DB_DATABASE: Joi.string().required(),
                JWT_SECRET: Joi.string().required(),
                JWT_EXPIRES_IN: Joi.string().default('30m'),
                JWT_REFRESH_SECRET: Joi.string().required(),
                JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
                APP_URL: Joi.string().required(),
            }),
        }),

        // Database connection
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get<string>('DB_HOST'),
                port: configService.get<number>('DB_PORT'),
                username: configService.get<string>('DB_USERNAME'),
                password: configService.get<string>('DB_PASSWORD'),
                database: configService.get<string>('DB_DATABASE'),
                autoLoadEntities: true,
                synchronize: configService.get<string>('NODE_ENV') === 'development',
                logging: configService.get<string>('NODE_ENV') === 'development',
            }),
        }),

        // Feature modules
        AuthModule,
        UsersModule,
        MailModule,
        GeoModule,
        FieldsModule,
        HarvestsModule,
        PaymentsModule,
        ReportsModule,
        ForumModule,
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule { }
