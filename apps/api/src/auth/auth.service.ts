import {
    Injectable,
    BadRequestException,
    UnauthorizedException,
    ConflictException,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '@/users/users.service';
import { MailService } from '@/mail/mail.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from '@/auth/dto';
import { User } from '@/users/entities/user.entity';
import { Session } from '@/auth/entities';

interface JwtPayload {
    sub: string;
    email: string;
}

export interface AuthUser {
    id: string;
    email: string;
    fullName: string;
    userType: string;
    phone: string;
    province: string;
    district: string;
    avatarUrl: string | null;
    role: string;
    caykurRole: string | null;
    caykurScope: string | null;
    cuzdanNo: string | null;
    quotaPerDekarKg: number | null;
    appointmentDays: string[] | null;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly SALT_ROUNDS = 12;
    private readonly VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
    private readonly RESET_TOKEN_EXPIRY_HOURS = 1;
    private readonly DELETION_TOKEN_EXPIRY_HOURS = 24;

    constructor(
        @InjectRepository(Session)
        private readonly sessionRepository: Repository<Session>,
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly mailService: MailService,
        private readonly configService: ConfigService,
    ) { }


    async register(registerDto: RegisterDto): Promise<{ message: string; email: string }> {
        const existingUser = await this.usersService.findByEmail(registerDto.email);
        if (existingUser) {
            throw new ConflictException('Bu email adresi zaten kayıtlı');
        }

        const existingTC = await this.usersService.findByFarmerIdNumber(registerDto.farmerIdNumber);
        if (existingTC) {
            throw new ConflictException('Bu TC Kimlik No zaten kayıtlı');
        }

        const existingPhone = await this.usersService.findByPhone(registerDto.phone);
        if (existingPhone) {
            throw new ConflictException('Bu telefon numarası zaten kayıtlı');
        }

        const existingCuzdan = await this.usersService.findByCuzdanNo(registerDto.cuzdanNo);
        if (existingCuzdan) {
            throw new ConflictException('Bu Çaykur Cüzdan No zaten kayıtlı');
        }

        const hashedPassword = await bcrypt.hash(registerDto.password, this.SALT_ROUNDS);
        const verificationToken = uuidv4();
        const verificationTokenExpiry = new Date();
        verificationTokenExpiry.setHours(
            verificationTokenExpiry.getHours() + this.VERIFICATION_TOKEN_EXPIRY_HOURS,
        );

        const user = await this.usersService.create({
            fullName: registerDto.fullName,
            email: registerDto.email.toLowerCase(),
            password: hashedPassword,
            phone: registerDto.phone,
            province: registerDto.province,
            district: registerDto.district,
            farmerIdNumber: registerDto.farmerIdNumber,
            cuzdanNo: registerDto.cuzdanNo,
            userType: registerDto.userType,
            emailVerified: false,
            verificationToken,
            verificationTokenExpiry,
        });

        await this.mailService.sendVerificationEmail(
            user.email,
            user.fullName,
            verificationToken,
        );

        this.logger.log(`User registered: ${user.email}`);

        return {
            message: 'Kayıt başarılı. Lütfen email adresinizi doğrulayın.',
            email: user.email,
        };
    }

    async verifyEmail(token: string): Promise<{ message: string }> {
        const user = await this.usersService.findByVerificationToken(token);

        if (!user) {
            throw new BadRequestException('Geçersiz doğrulama linki');
        }

        if (user.emailVerified) {
            throw new BadRequestException('Email zaten doğrulanmış');
        }

        if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
            throw new BadRequestException('Doğrulama linkinin süresi dolmuş');
        }

        await this.usersService.update(user.id, {
            emailVerified: true,
            verifiedAt: new Date(),
            verificationToken: null,
            verificationTokenExpiry: null,
        });

        this.logger.log(`Email verified for: ${user.email}`);

        return { message: 'Email başarıyla doğrulandı' };
    }

    async resendVerification(email: string): Promise<{ message: string }> {
        const user = await this.usersService.findByEmail(email);

        if (!user) {
            // Security: Don't reveal if email exists
            return { message: 'Eğer email kayıtlıysa, doğrulama linki gönderildi' };
        }

        if (user.emailVerified) {
            throw new BadRequestException('Email zaten doğrulanmış');
        }

        const verificationToken = uuidv4();
        const verificationTokenExpiry = new Date();
        verificationTokenExpiry.setHours(
            verificationTokenExpiry.getHours() + this.VERIFICATION_TOKEN_EXPIRY_HOURS,
        );

        await this.usersService.update(user.id, {
            verificationToken,
            verificationTokenExpiry,
        });

        await this.mailService.sendVerificationEmail(
            user.email,
            user.fullName,
            verificationToken,
        );

        return { message: 'Doğrulama emaili tekrar gönderildi' };
    }

    async login(loginDto: LoginDto): Promise<AuthResponse> {
        const user = await this.usersService.findByEmail(loginDto.email);

        if (!user) {
            throw new UnauthorizedException('Email veya şifre hatalı');
        }

        if (user.suspended) {
            throw new UnauthorizedException('Hesabınız askıya alınmış');
        }

        if (!user.emailVerified) {
            throw new UnauthorizedException('Email doğrulaması gerekli');
        }

        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Email veya şifre hatalı');
        }

        // Generate access and refresh tokens
        const tokens = await this.generateTokens(user.id, user.email);

        this.logger.log(`User logged in: ${user.email}`);

        return {
            ...tokens,
            user: this.toAuthUser(user),
        };
    }

    private toAuthUser(user: User): AuthUser {
        return {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            userType: user.userType,
            role: user.role,
            phone: user.phone,
            province: user.province,
            district: user.district,
            avatarUrl: user.avatarUrl,
            caykurRole: user.caykurRole,
            caykurScope: user.caykurScope,
            cuzdanNo: user.cuzdanNo,
            quotaPerDekarKg: user.quotaPerDekarKg,
            appointmentDays: user.appointmentDays,
        };
    }

    async forgotPassword(email: string): Promise<{ message: string }> {
        const user = await this.usersService.findByEmail(email);

        // Always return success for security
        if (!user) {
            return {
                message: 'Eğer email kayıtlıysa, şifre sıfırlama linki gönderildi',
            };
        }

        const resetToken = uuidv4();
        const resetTokenExpiry = new Date();
        resetTokenExpiry.setHours(
            resetTokenExpiry.getHours() + this.RESET_TOKEN_EXPIRY_HOURS,
        );

        await this.usersService.update(user.id, {
            resetPasswordToken: resetToken,
            resetPasswordTokenExpiry: resetTokenExpiry,
        });

        await this.mailService.sendPasswordResetEmail(user.email, user.fullName, resetToken);

        return {
            message: 'Eğer email kayıtlıysa, şifre sıfırlama linki gönderildi',
        };
    }

    async validateResetToken(token: string): Promise<{ valid: boolean }> {
        const user = await this.usersService.findByResetToken(token);

        if (!user) {
            return { valid: false };
        }

        if (user.resetPasswordTokenExpiry && user.resetPasswordTokenExpiry < new Date()) {
            return { valid: false };
        }

        return { valid: true };
    }

    async resetPassword(
        token: string,
        newPassword: string,
        ipAddress: string,
    ): Promise<{ message: string }> {
        const user = await this.usersService.findByResetToken(token);

        if (!user) {
            throw new BadRequestException('Geçersiz veya süresi dolmuş link');
        }

        if (user.resetPasswordTokenExpiry && user.resetPasswordTokenExpiry < new Date()) {
            throw new BadRequestException('Şifre sıfırlama linkinin süresi dolmuş');
        }

        const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

        await this.usersService.update(user.id, {
            password: hashedPassword,
            resetPasswordToken: null,
            resetPasswordTokenExpiry: null,
        });

        await this.mailService.sendPasswordChangedEmail(user.email, user.fullName, ipAddress);

        this.logger.log(`Password reset for: ${user.email}`);

        return { message: 'Şifre başarıyla değiştirildi' };
    }

    async changePassword(
        userId: string,
        changePasswordDto: ChangePasswordDto,
        ipAddress: string,
    ): Promise<{ message: string }> {
        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new BadRequestException('Kullanıcı bulunamadı');
        }

        const isCurrentPasswordValid = await bcrypt.compare(
            changePasswordDto.currentPassword,
            user.password,
        );

        if (!isCurrentPasswordValid) {
            throw new BadRequestException('Mevcut şifre hatalı');
        }

        const isSamePassword = await bcrypt.compare(
            changePasswordDto.newPassword,
            user.password,
        );

        if (isSamePassword) {
            throw new BadRequestException('Yeni şifre mevcut şifre ile aynı olamaz');
        }

        const hashedPassword = await bcrypt.hash(
            changePasswordDto.newPassword,
            this.SALT_ROUNDS,
        );

        await this.usersService.update(user.id, { password: hashedPassword });

        await this.mailService.sendPasswordChangedEmail(user.email, user.fullName, ipAddress);

        this.logger.log(`Password changed for: ${user.email}`);

        return { message: 'Şifre başarıyla değiştirildi' };
    }

    async requestDeletion(userId: string, email: string): Promise<{ message: string }> {
        const user = await this.usersService.findById(userId);

        if (!user) {
            throw new BadRequestException('Kullanıcı bulunamadı');
        }

        if (user.email.toLowerCase() !== email.toLowerCase()) {
            throw new BadRequestException('Email adresi eşleşmiyor');
        }

        const deletionToken = uuidv4();
        const deletionTokenExpiry = new Date();
        deletionTokenExpiry.setHours(
            deletionTokenExpiry.getHours() + this.DELETION_TOKEN_EXPIRY_HOURS,
        );

        await this.usersService.update(user.id, {
            deletionToken,
            deletionTokenExpiry,
        });

        await this.mailService.sendDeletionConfirmationEmail(
            user.email,
            user.fullName,
            deletionToken,
        );

        return { message: 'Hesap silme onay emaili gönderildi' };
    }

    async validateDeletionToken(
        token: string,
    ): Promise<{ valid: boolean; userData?: Record<string, unknown> }> {
        const user = await this.usersService.findByDeletionToken(token);

        if (!user) {
            return { valid: false };
        }

        if (user.deletionTokenExpiry && user.deletionTokenExpiry < new Date()) {
            return { valid: false };
        }

        const countData = await this.usersService.countUserData(user.id);

        return {
            valid: true,
            userData: {
                fullName: user.fullName,
                email: user.email,
                createdAt: user.createdAt,
                ...countData,
            },
        };
    }

    async deleteAccount(token: string): Promise<{ message: string }> {
        const user = await this.usersService.findByDeletionToken(token);

        if (!user) {
            throw new BadRequestException('Geçersiz veya süresi dolmuş link');
        }

        if (user.deletionTokenExpiry && user.deletionTokenExpiry < new Date()) {
            throw new BadRequestException('Hesap silme linkinin süresi dolmuş');
        }

        const emailToNotify = user.email;

        await this.usersService.softDelete(user.id);

        await this.mailService.sendAccountDeletedEmail(emailToNotify);

        this.logger.log(`Account deleted: ${emailToNotify}`);

        return { message: 'Hesap başarıyla silindi' };
    }

    async validateUser(payload: JwtPayload): Promise<User | null> {
        return this.usersService.findById(payload.sub);
    }

    // ===== REFRESH TOKEN METHODS =====

    async generateTokens(userId: string, email: string): Promise<{ accessToken: string; refreshToken: string }> {
        const payload: JwtPayload = { sub: userId, email };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('JWT_SECRET'),
                expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '30m'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
                expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
            }),
        ]);

        // Hash and store refresh token
        const hashedRefreshToken = await bcrypt.hash(refreshToken, this.SALT_ROUNDS);
        await this.usersService.update(userId, {
            refreshToken: hashedRefreshToken,
            lastLogin: new Date(),
        });

        return { accessToken, refreshToken };
    }

    async validateRefreshToken(userId: string, refreshToken: string): Promise<User | null> {
        const user = await this.usersService.findById(userId);

        if (!user || !user.refreshToken) {
            return null;
        }

        const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
        if (!isValid) {
            return null;
        }

        return user;
    }

    async refreshTokens(userId: string, refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
        const user = await this.validateRefreshToken(userId, refreshToken);

        if (!user) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        // Generate new token pair (rotation)
        const tokens = await this.generateTokens(user.id, user.email);

        this.logger.log(`Tokens refreshed for: ${user.email}`);

        return tokens;
    }

    async logout(userId: string): Promise<{ message: string }> {
        await this.usersService.update(userId, { refreshToken: null });

        this.logger.log(`User logged out: ${userId}`);

        return { message: 'Çıkış yapıldı' };
    }

    async getCurrentUser(userId: string): Promise<AuthUser | null> {
        const user = await this.usersService.findById(userId);

        if (!user) {
            return null;
        }

        return this.toAuthUser(user);
    }

    // Session Management Methods

    async createSession(
        userId: string,
        refreshToken: string,
        metadata: {
            userAgent?: string;
            ipAddress?: string;
            deviceType?: string;
            browser?: string;
            os?: string;
        },
    ): Promise<Session> {
        const expiresAt = new Date();
        const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
        const days = parseInt(refreshExpiresIn.replace('d', ''), 10) || 7;
        expiresAt.setDate(expiresAt.getDate() + days);

        const session = this.sessionRepository.create({
            userId,
            refreshToken,
            userAgent: metadata.userAgent || null,
            ipAddress: metadata.ipAddress || null,
            deviceType: metadata.deviceType || null,
            browser: metadata.browser || null,
            os: metadata.os || null,
            isActive: true,
            lastActivityAt: new Date(),
            expiresAt,
        });

        return this.sessionRepository.save(session);
    }

    async getSessions(userId: string): Promise<Session[]> {
        return this.sessionRepository.find({
            where: { userId, isActive: true },
            order: { lastActivityAt: 'DESC' },
        });
    }

    async revokeSession(userId: string, sessionId: string): Promise<{ message: string }> {
        const session = await this.sessionRepository.findOne({
            where: { id: sessionId, userId },
        });

        if (!session) {
            throw new NotFoundException('Session not found');
        }

        session.isActive = false;
        await this.sessionRepository.save(session);

        this.logger.log(`Session revoked: ${sessionId} for user: ${userId}`);

        return { message: 'Oturum sonlandırıldı' };
    }

    async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<{ message: string; count: number }> {
        const query = this.sessionRepository
            .createQueryBuilder()
            .update(Session)
            .set({ isActive: false })
            .where('userId = :userId', { userId })
            .andWhere('isActive = :isActive', { isActive: true });

        if (exceptSessionId) {
            query.andWhere('id != :exceptSessionId', { exceptSessionId });
        }

        const result = await query.execute();

        this.logger.log(`All sessions revoked for user: ${userId}, count: ${result.affected}`);

        return {
            message: 'Tüm oturumlar sonlandırıldı',
            count: result.affected || 0,
        };
    }

    async updateSessionActivity(sessionId: string): Promise<void> {
        await this.sessionRepository.update(sessionId, {
            lastActivityAt: new Date(),
        });
    }
}
