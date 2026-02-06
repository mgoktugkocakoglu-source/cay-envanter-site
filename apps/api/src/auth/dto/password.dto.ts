import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ForgotPasswordDto {
    @ApiProperty({ example: 'ahmet@example.com', description: 'Email address' })
    @IsEmail({}, { message: 'Geçerli bir email adresi giriniz' })
    email: string;
}

export class ResetPasswordDto {
    @ApiProperty({ description: 'Reset token from email' })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({ example: 'NewSecurePass123', description: 'New password' })
    @IsString()
    @MinLength(8, { message: 'Şifre en az 8 karakter olmalıdır' })
    @Matches(/(?=.*[a-z])/, {
        message: 'Şifre en az bir küçük harf içermelidir',
    })
    @Matches(/(?=.*[A-Z])/, {
        message: 'Şifre en az bir büyük harf içermelidir',
    })
    @Matches(/(?=.*[0-9])/, { message: 'Şifre en az bir rakam içermelidir' })
    newPassword: string;
}

export class ChangePasswordDto {
    @ApiProperty({ description: 'Current password' })
    @IsString()
    @IsNotEmpty({ message: 'Mevcut şifre gereklidir' })
    currentPassword: string;

    @ApiProperty({ example: 'NewSecurePass123', description: 'New password' })
    @IsString()
    @MinLength(8, { message: 'Şifre en az 8 karakter olmalıdır' })
    @Matches(/(?=.*[a-z])/, {
        message: 'Şifre en az bir küçük harf içermelidir',
    })
    @Matches(/(?=.*[A-Z])/, {
        message: 'Şifre en az bir büyük harf içermelidir',
    })
    @Matches(/(?=.*[0-9])/, { message: 'Şifre en az bir rakam içermelidir' })
    newPassword: string;
}
