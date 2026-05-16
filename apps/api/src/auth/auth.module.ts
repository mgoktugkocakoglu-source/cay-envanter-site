import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from '@/auth/auth.controller';
import { AuthService } from '@/auth/auth.service';
import { JwtStrategy } from '@/auth/strategies/jwt.strategy';
import { RefreshTokenStrategy } from '@/auth/strategies/refresh-token.strategy';
import { Session } from '@/auth/entities';
import { UsersModule } from '@/users/users.module';
import { MailModule } from '@/mail/mail.module';
import { UploadsModule } from '@/uploads/uploads.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Session]),
        UsersModule,
        MailModule,
        UploadsModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.get<string>('JWT_EXPIRES_IN', '30m'),
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, RefreshTokenStrategy],
    exports: [AuthService],
})
export class AuthModule { }


