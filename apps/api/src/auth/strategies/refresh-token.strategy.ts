import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '@/auth/auth.service';

interface JwtPayload {
    sub: string;
    email: string;
}

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(
        configService: ConfigService,
        private readonly authService: AuthService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
            passReqToCallback: true,
        });
    }

    async validate(req: Request, payload: JwtPayload) {
        const refreshToken = req.get('Authorization')?.replace('Bearer ', '').trim();

        if (!refreshToken) {
            throw new UnauthorizedException('Refresh token not found');
        }

        const user = await this.authService.validateRefreshToken(payload.sub, refreshToken);
        if (!user) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        return { id: user.id, email: user.email, refreshToken };
    }
}
