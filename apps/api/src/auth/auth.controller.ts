import {
    Controller,
    Post,
    Get,
    Delete,
    Patch,
    Body,
    Query,
    Param,
    Req,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    HttpCode,
    HttpStatus,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService, AuthResponse } from '@/auth/auth.service';
import { UsersService } from '@/users/users.service';
import { R2StorageService } from '@/uploads/r2-storage.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '@/auth/decorators';
import {
    RegisterDto,
    LoginDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    ChangePasswordDto,
    RequestDeletionDto,
    ConfirmDeletionDto,
} from '@/auth/dto';

/** File filter allowing only image MIME types */
const avatarFileFilter = (
    _req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
): void => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
        return callback(
            new BadRequestException('Sadece JPEG, PNG, GIF ve WebP dosyalari yuklenebilir.'),
            false,
        );
    }
    callback(null, true);
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
        private readonly r2StorageService: R2StorageService,
    ) { }

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    @ApiResponse({ status: 409, description: 'Email already exists' })
    async register(@Body() registerDto: RegisterDto): Promise<{ message: string; email: string }> {
        return this.authService.register(registerDto);
    }

    @Get('verify-email')
    @ApiOperation({ summary: 'Verify email address' })
    @ApiResponse({ status: 200, description: 'Email verified successfully' })
    @ApiResponse({ status: 400, description: 'Invalid or expired token' })
    async verifyEmail(@Query('token') token: string): Promise<{ message: string }> {
        return this.authService.verifyEmail(token);
    }

    @Post('resend-verification')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Resend verification email' })
    @ApiResponse({ status: 200, description: 'Verification email sent' })
    async resendVerification(@Body('email') email: string): Promise<{ message: string }> {
        return this.authService.resendVerification(email);
    }

    @Post('login')
    @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'User login' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    @ApiResponse({ status: 429, description: 'Too many login attempts' })
    async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
        return this.authService.login(loginDto);
    }

    @Post('forgot-password')
    @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 requests per 15 minutes
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Request password reset' })
    @ApiResponse({ status: 200, description: 'Reset email sent if user exists' })
    @ApiResponse({ status: 429, description: 'Too many password reset requests' })
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
        return this.authService.forgotPassword(forgotPasswordDto.email);
    }

    @Get('validate-reset-token')
    @ApiOperation({ summary: 'Validate password reset token' })
    @ApiResponse({ status: 200, description: 'Token validation result' })
    async validateResetToken(@Query('token') token: string) {
        return this.authService.validateResetToken(token);
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reset password with token' })
    @ApiResponse({ status: 200, description: 'Password reset successful' })
    @ApiResponse({ status: 400, description: 'Invalid or expired token' })
    async resetPassword(@Body() resetPasswordDto: ResetPasswordDto, @Req() req: Request) {
        const ipAddress = req.ip || req.socket.remoteAddress || 'Unknown';
        return this.authService.resetPassword(
            resetPasswordDto.token,
            resetPasswordDto.newPassword,
            ipAddress,
        );
    }

    @Post('change-password')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Change password (authenticated)' })
    @ApiResponse({ status: 200, description: 'Password changed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid current password' })
    async changePassword(
        @CurrentUser() user: AuthenticatedUser,
        @Req() req: Request,
        @Body() changePasswordDto: ChangePasswordDto,
    ) {
        const ipAddress = req.ip || req.socket.remoteAddress || 'Unknown';
        return this.authService.changePassword(user.id, changePasswordDto, ipAddress);
    }

    @Post('request-deletion')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Request account deletion' })
    @ApiResponse({ status: 200, description: 'Deletion confirmation email sent' })
    async requestDeletion(
        @CurrentUser() user: AuthenticatedUser,
        @Body() requestDeletionDto: RequestDeletionDto,
    ) {
        return this.authService.requestDeletion(user.id, requestDeletionDto.email);
    }

    @Get('validate-deletion-token')
    @ApiOperation({ summary: 'Validate deletion token' })
    @ApiResponse({ status: 200, description: 'Token validation result with user data' })
    async validateDeletionToken(@Query('token') token: string) {
        return this.authService.validateDeletionToken(token);
    }

    @Post('delete-account')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Confirm account deletion' })
    @ApiResponse({ status: 200, description: 'Account deleted successfully' })
    @ApiResponse({ status: 400, description: 'Invalid or expired token' })
    async deleteAccount(@Body() confirmDeletionDto: ConfirmDeletionDto) {
        return this.authService.deleteAccount(confirmDeletionDto.token);
    }

    // ===== REFRESH TOKEN ENDPOINTS =====

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refresh access token' })
    @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
    @ApiResponse({ status: 401, description: 'Invalid refresh token' })
    async refreshTokens(@Body() body: { refreshToken: string }, @Req() req: Request) {
        // Extract user ID from the refresh token
        const token = body.refreshToken;
        try {
            const payload = this.authService['jwtService'].verify(token, {
                secret: this.authService['configService'].get<string>('JWT_REFRESH_SECRET'),
            });
            return this.authService.refreshTokens(payload.sub, token);
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Logout user' })
    @ApiResponse({ status: 200, description: 'Logged out successfully' })
    async logout(@CurrentUser('id') userId: string) {
        return this.authService.logout(userId);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user' })
    @ApiResponse({ status: 200, description: 'Current user info' })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    async getCurrentUser(@CurrentUser('id') userId: string) {
        return this.authService.getCurrentUser(userId);
    }

    // ===== AVATAR MANAGEMENT ENDPOINTS =====

    @Patch('avatar')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Upload or update avatar' })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 200, description: 'Avatar updated successfully' })
    @ApiResponse({ status: 400, description: 'Invalid file' })
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            fileFilter: avatarFileFilter,
            limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for avatars
        }),
    )
    async uploadAvatar(
        @CurrentUser('id') userId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('Dosya yuklenemedi.');
        }

        const uploaded = await this.r2StorageService.upload(file, 'avatars');
        const avatarUrl = uploaded.url;
        await this.usersService.update(userId, { avatarUrl });

        return { avatarUrl };
    }

    @Delete('avatar')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Remove avatar' })
    @ApiResponse({ status: 200, description: 'Avatar removed' })
    async removeAvatar(@CurrentUser('id') userId: string) {
        await this.usersService.update(userId, { avatarUrl: null });
        return { message: 'Avatar kaldirildi' };
    }

    // ===== SESSION MANAGEMENT ENDPOINTS =====

    @Get('sessions')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all active sessions' })
    @ApiResponse({ status: 200, description: 'List of active sessions' })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    async getSessions(@CurrentUser('id') userId: string) {
        return this.authService.getSessions(userId);
    }

    @Delete('sessions/:sessionId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Revoke a specific session' })
    @ApiResponse({ status: 200, description: 'Session revoked' })
    @ApiResponse({ status: 404, description: 'Session not found' })
    async revokeSession(
        @CurrentUser('id') userId: string,
        @Param('sessionId') sessionId: string,
    ) {
        return this.authService.revokeSession(userId, sessionId);
    }

    @Delete('sessions')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Revoke all sessions except current' })
    @ApiResponse({ status: 200, description: 'All sessions revoked' })
    async revokeAllSessions(
        @CurrentUser('id') userId: string,
        @Query('exceptCurrent') exceptCurrent?: string,
    ) {
        // If exceptCurrent is provided, it should be the current session ID
        return this.authService.revokeAllSessions(userId, exceptCurrent);
    }
}

