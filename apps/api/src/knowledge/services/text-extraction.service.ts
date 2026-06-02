import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import { extractRawText } from 'mammoth';

const PDF_MIME = 'application/pdf';
const DOCX_MIME =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME = 'application/msword';

/**
 * Extracts plain text from uploaded documents so they can be indexed for the
 * AI agent. Supports PDF, DOCX, and plain-text formats (TXT/MD).
 */
@Injectable()
export class TextExtractionService {
    private readonly logger = new Logger(TextExtractionService.name);

    /** Whether a file can be turned into text by {@link extract}. */
    isSupported(mimeType: string, fileName: string): boolean {
        const name = fileName.toLowerCase();
        return (
            mimeType === PDF_MIME ||
            mimeType === DOCX_MIME ||
            mimeType.startsWith('text/') ||
            name.endsWith('.pdf') ||
            name.endsWith('.docx') ||
            name.endsWith('.txt') ||
            name.endsWith('.md')
        );
    }

    async extract(file: Express.Multer.File): Promise<string> {
        const { mimetype, originalname, buffer } = file;
        const name = originalname.toLowerCase();

        if (mimetype === DOC_MIME || name.endsWith('.doc')) {
            throw new BadRequestException(
                'Eski .doc biçimi desteklenmiyor. Lütfen .docx, PDF, TXT veya MD olarak yükleyin.',
            );
        }

        try {
            if (mimetype === PDF_MIME || name.endsWith('.pdf')) {
                const result = await pdfParse(buffer);
                return result.text;
            }

            if (mimetype === DOCX_MIME || name.endsWith('.docx')) {
                const result = await extractRawText({ buffer });
                return result.value;
            }

            if (
                mimetype.startsWith('text/') ||
                name.endsWith('.txt') ||
                name.endsWith('.md')
            ) {
                return buffer.toString('utf-8');
            }
        } catch (error) {
            this.logger.error(
                `Text extraction failed for "${originalname}": ${error}`,
            );
            throw new BadRequestException(
                'Dosyadan metin çıkarılamadı. Dosya bozuk veya parola korumalı olabilir.',
            );
        }

        throw new BadRequestException(
            'Desteklenmeyen dosya türü. PDF, DOCX, TXT veya MD yükleyebilirsiniz.',
        );
    }
}
