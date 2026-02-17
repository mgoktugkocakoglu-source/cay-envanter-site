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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuid } from 'uuid';
import { existsSync } from 'fs';
import { Response, Request } from 'express';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

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

const storage = diskStorage({
    destination: (
        _req: Request,
        _file: Express.Multer.File,
        cb: (error: Error | null, destination: string) => void,
    ): void => {
        const { mkdirSync } = require('fs');
        mkdirSync(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
    },
    filename: (
        _req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, filename: string) => void,
    ): void => {
        const uniqueName = `${uuid()}${extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});

@Controller('uploads')
export class UploadsController {
    @Post('image')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(
        FileInterceptor('file', {
            storage,
            fileFilter: imageFileFilter,
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
        }),
    )
    uploadImage(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('Dosya yuklenemedi.');
        }
        return {
            url: `/api/uploads/file/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
        };
    }

    @Get('file/:filename')
    getFile(@Param('filename') filename: string, @Res() res: Response) {
        // Sanitize filename to prevent directory traversal
        const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '');
        const filePath = join(UPLOAD_DIR, sanitized);

        if (!existsSync(filePath)) {
            return res.status(404).json({ message: 'Dosya bulunamadi.' });
        }

        return res.sendFile(filePath);
    }
}
