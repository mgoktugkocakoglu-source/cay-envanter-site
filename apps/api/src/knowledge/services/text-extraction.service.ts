import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import { extractRawText } from 'mammoth';

const PDF_MIME = 'application/pdf';
const DOCX_MIME =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME = 'application/msword';

/** Text of one page of a paginated document. */
export interface ExtractedPage {
    pageNumber: number;
    text: string;
}

export interface ExtractedText {
    text: string;
    /** Per-page text when the format has pages (PDF); empty otherwise. */
    pages: ExtractedPage[];
    pageCount: number;
}

/** Subset of pdf.js's page proxy that `pagerender` receives. */
interface PdfPageData {
    pageIndex?: number;
    pageNumber?: number;
    getTextContent(options: {
        normalizeWhitespace: boolean;
        disableCombineTextItems: boolean;
    }): Promise<{ items: Array<{ str: string; transform: number[] }> }>;
}

/**
 * Extracts plain text from uploaded documents so they can be indexed for the
 * AI agent. Supports PDF (with page tracking), DOCX, and plain text (TXT/MD).
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

    async extract(file: Express.Multer.File): Promise<ExtractedText> {
        const { mimetype, originalname, buffer } = file;
        const name = originalname.toLowerCase();

        if (mimetype === DOC_MIME || name.endsWith('.doc')) {
            throw new BadRequestException(
                'Eski .doc biçimi desteklenmiyor. Lütfen .docx, PDF, TXT veya MD olarak yükleyin.',
            );
        }

        try {
            if (mimetype === PDF_MIME || name.endsWith('.pdf')) {
                return await this.extractPdf(buffer);
            }

            if (mimetype === DOCX_MIME || name.endsWith('.docx')) {
                const result = await extractRawText({ buffer });
                return { text: result.value, pages: [], pageCount: 0 };
            }

            if (
                mimetype.startsWith('text/') ||
                name.endsWith('.txt') ||
                name.endsWith('.md')
            ) {
                return { text: buffer.toString('utf-8'), pages: [], pageCount: 0 };
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

    /**
     * Renders each PDF page separately so chunks can cite a page number and the
     * viewer can jump straight to it.
     */
    private async extractPdf(buffer: Buffer): Promise<ExtractedText> {
        const pages: ExtractedPage[] = [];

        const pagerender = async (pageData: PdfPageData): Promise<string> => {
            const content = await pageData.getTextContent({
                normalizeWhitespace: true,
                disableCombineTextItems: false,
            });

            let lastY: number | undefined;
            let text = '';
            for (const item of content.items) {
                const y = item.transform?.[5];
                if (lastY === undefined || lastY === y) {
                    text += item.str;
                } else {
                    text += `\n${item.str}`;
                }
                lastY = y;
            }

            const pageNumber =
                pageData.pageNumber ??
                (pageData.pageIndex !== undefined ? pageData.pageIndex + 1 : pages.length + 1);
            pages.push({ pageNumber, text });
            return text;
        };

        const result = await pdfParse(buffer, { pagerender });
        pages.sort((a, b) => a.pageNumber - b.pageNumber);

        return {
            text: result.text,
            pages,
            pageCount: result.numpages ?? pages.length,
        };
    }
}
