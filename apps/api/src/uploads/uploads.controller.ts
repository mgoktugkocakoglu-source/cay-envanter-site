import {
    Controller,
    Post,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    Get,
    Param,
    Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/auth/guards';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { existsSync } from 'fs';
import { Request, Response } from 'express';
import { R2StorageService } from './r2-storage.service';

const LEGACY_UPLOAD_DIR = join(process.cwd(), 'uploads');

const imageFileFilter = (
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

const videoFileFilter = (
    _req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
): void => {
    const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!allowedMimes.includes(file.mimetype)) {
        return callback(
            new BadRequestException('Sadece MP4, WebM, MOV ve AVI video dosyalari yuklenebilir.'),
            false,
        );
    }
    callback(null, true);
};

@Controller('uploads')
export class UploadsController {
    constructor(private readonly r2StorageService: R2StorageService) {}

    @Post('image')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            fileFilter: imageFileFilter,
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
        }),
    )
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('Dosya yuklenemedi.');
        }
        const uploaded = await this.r2StorageService.upload(file, 'images');
        return {
            url: uploaded.url,
            filename: uploaded.filename,
            key: uploaded.key,
            originalName: file.originalname,
            size: file.size,
        };
    }

    @Post('video')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            fileFilter: videoFileFilter,
            limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
        }),
    )
    async uploadVideo(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('Video yuklenemedi.');
        }
        const uploaded = await this.r2StorageService.upload(file, 'videos');
        return {
            url: uploaded.url,
            filename: uploaded.filename,
            key: uploaded.key,
            originalName: file.originalname,
            size: file.size,
        };
    }

    @Get('file/:filename')
    getLegacyFile(@Param('filename') filename: string, @Res() res: Response) {
        const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '');
        const filePath = join(LEGACY_UPLOAD_DIR, sanitized);

        if (!existsSync(filePath)) {
            return res.status(404).json({ message: 'Dosya bulunamadi.' });
        }

        return res.sendFile(filePath);
    }
}
