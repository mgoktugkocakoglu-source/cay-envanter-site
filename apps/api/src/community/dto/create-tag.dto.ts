import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTagDto {
    @ApiProperty({ description: 'Tag slug name', maxLength: 50 })
    @IsString()
    @MaxLength(50)
    name: string;

    @ApiProperty({ description: 'Tag display name', maxLength: 100 })
    @IsString()
    @MaxLength(100)
    displayName: string;
}
