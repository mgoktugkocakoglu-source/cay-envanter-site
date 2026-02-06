import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RequestDeletionDto {
    @ApiProperty({ description: 'Email confirmation for deletion' })
    @IsEmail({}, { message: 'Geçerli bir email adresi giriniz' })
    email: string;
}

export class ConfirmDeletionDto {
    @ApiProperty({ description: 'Deletion token from email' })
    @IsString()
    @IsNotEmpty()
    token: string;
}
