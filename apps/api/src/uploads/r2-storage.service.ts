import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';

export type UploadFolder = 'avatars' | 'images' | 'videos';

export interface StoredFile {
    key: string;
    url: string;
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
}

@Injectable()
export class R2StorageService {
    private readonly client: S3Client;
    private readonly bucket: string;
    private readonly publicUrl: string;
    private readonly prefix: string;

    constructor(private readonly configService: ConfigService) {
        const accountId = this.configService.get<string>('R2_ACCOUNT_ID', '');
        const endpoint = this.configService.get<string>('R2_ENDPOINT', '');
        const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID', '');
        const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY', '');

        this.bucket = this.configService.get<string>('R2_BUCKET', '');
        this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL', '').replace(/\/+$/, '');
        this.prefix = this.configService.get<string>('R2_PREFIX', '').replace(/^\/+|\/+$/g, '');

        this.client = new S3Client({
            region: 'auto',
            endpoint: endpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined),
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
            forcePathStyle: true,
        });
    }

    async upload(file: Express.Multer.File, folder: UploadFolder): Promise<StoredFile> {
        this.assertConfigured();

        const extension = extname(file.originalname).toLowerCase();
        const filename = `${uuid()}${extension}`;
        const key = this.buildKey(folder, filename);

        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            ContentLength: file.size,
            ContentDisposition: 'inline',
        }));

        return {
            key,
            url: this.toPublicUrl(key),
            filename,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
        };
    }

    toPublicUrl(key: string): string {
        const safeKey = key
            .split('/')
            .map((part) => encodeURIComponent(part))
            .join('/');

        return `${this.publicUrl}/${safeKey}`;
    }

    private buildKey(folder: UploadFolder, filename: string): string {
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const segments = [this.prefix, folder, String(year), month, filename].filter(Boolean);

        return segments.join('/');
    }

    private assertConfigured(): void {
        const missing = [
            ['R2_BUCKET', this.bucket],
            ['R2_PUBLIC_URL', this.publicUrl],
            ['R2_ACCESS_KEY_ID', this.configService.get<string>('R2_ACCESS_KEY_ID', '')],
            ['R2_SECRET_ACCESS_KEY', this.configService.get<string>('R2_SECRET_ACCESS_KEY', '')],
        ].filter(([, value]) => !value);

        const hasEndpoint = !!this.configService.get<string>('R2_ENDPOINT', '');
        const hasAccountId = !!this.configService.get<string>('R2_ACCOUNT_ID', '');

        if (missing.length > 0 || (!hasEndpoint && !hasAccountId)) {
            const missingNames = missing.map(([name]) => name);
            if (!hasEndpoint && !hasAccountId) missingNames.push('R2_ACCOUNT_ID or R2_ENDPOINT');

            throw new InternalServerErrorException(
                `Cloudflare R2 ayarlari eksik: ${missingNames.join(', ')}`,
            );
        }
    }
}
