import {
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    KnowledgeDocument,
    KnowledgeDocumentChunk,
} from '@/knowledge/entities';
import { DocumentStatus } from '@/knowledge/enums';
import {
    ChatDto,
    ChatResponse,
    ChatSource,
    DocumentSummary,
    KnowledgeStatus,
} from '@/knowledge/dto';
import { TextExtractionService } from '@/knowledge/services/text-extraction.service';
import {
    AiChatService,
    RetrievedChunk,
} from '@/knowledge/services/ai-chat.service';

const MAX_CHUNK_CHARS = 1200;
const MIN_CHUNK_CHARS = 20;
const RETRIEVAL_LIMIT = 6;
const SNIPPET_CHARS = 220;

/** Postgres text-search configuration with Turkish stemming and stop words. */
const FTS_CONFIG = 'turkish';

interface RetrievedRow {
    documentId: string;
    title: string;
    content: string;
}

/**
 * Owns the AI agent's knowledge base: ingesting uploaded documents, retrieving
 * relevant passages via PostgreSQL full-text search, and orchestrating chat
 * answers through {@link AiChatService}.
 */
@Injectable()
export class KnowledgeService implements OnModuleInit {
    private readonly logger = new Logger(KnowledgeService.name);

    constructor(
        @InjectRepository(KnowledgeDocument)
        private readonly documentRepository: Repository<KnowledgeDocument>,
        @InjectRepository(KnowledgeDocumentChunk)
        private readonly chunkRepository: Repository<KnowledgeDocumentChunk>,
        private readonly textExtractionService: TextExtractionService,
        private readonly aiChatService: AiChatService,
    ) {}

    /**
     * Creates a GIN full-text index for chunk content so retrieval stays fast
     * as the knowledge base grows. Safe to run on every boot; failures are
     * non-fatal (retrieval falls back to a sequential scan).
     */
    async onModuleInit(): Promise<void> {
        try {
            await this.chunkRepository.query(
                `CREATE INDEX IF NOT EXISTS idx_kdc_content_fts ON knowledge_document_chunks USING gin (to_tsvector('${FTS_CONFIG}', content))`,
            );
        } catch (error) {
            this.logger.warn(
                `Could not create full-text index, retrieval will use a sequential scan: ${error}`,
            );
        }
    }

    // ─── Documents ───

    async findAll(): Promise<DocumentSummary[]> {
        const documents = await this.documentRepository.find({
            order: { createdAt: 'DESC' },
        });
        return documents.map((document) => this.toSummary(document));
    }

    async createFromFile(
        file: Express.Multer.File,
        title: string | undefined,
        userId: string,
    ): Promise<DocumentSummary> {
        const text = await this.textExtractionService.extract(file);
        const meaningfulLength = text.replace(/\s/g, '').length;

        if (meaningfulLength < MIN_CHUNK_CHARS) {
            throw new BadRequestException(
                'Dosyadan okunabilir metin çıkarılamadı. Taranmış (resim) bir PDF ise metin içeren bir sürüm yükleyin.',
            );
        }

        const chunks = this.chunkText(text);

        const document = this.documentRepository.create({
            title: (title?.trim() || file.originalname).slice(0, 255),
            fileName: file.originalname.slice(0, 255),
            mimeType: (file.mimetype || 'application/octet-stream').slice(0, 150),
            fileSize: file.size ?? 0,
            status: DocumentStatus.Ready,
            charCount: text.trim().length,
            chunkCount: chunks.length,
            errorMessage: null,
            uploadedById: userId ?? null,
            chunks: chunks.map((content, index) =>
                this.chunkRepository.create({ chunkIndex: index, content }),
            ),
        });

        const saved = await this.documentRepository.save(document);
        this.logger.log(
            `Indexed document "${saved.title}" (${saved.chunkCount} chunks, ${saved.charCount} chars)`,
        );
        return this.toSummary(saved);
    }

    async remove(id: string): Promise<void> {
        const result = await this.documentRepository.delete(id);
        if (!result.affected) {
            throw new NotFoundException('Belge bulunamadı.');
        }
    }

    async getStatus(): Promise<KnowledgeStatus> {
        const [documentCount, readyDocumentCount, chunkCount] =
            await Promise.all([
                this.documentRepository.count(),
                this.documentRepository.count({
                    where: { status: DocumentStatus.Ready },
                }),
                this.chunkRepository.count(),
            ]);

        return {
            aiConfigured: this.aiChatService.isConfigured,
            model: this.aiChatService.modelName,
            documentCount,
            readyDocumentCount,
            chunkCount,
        };
    }

    // ─── Chat ───

    async chat(dto: ChatDto): Promise<ChatResponse> {
        const chunks = await this.retrieve(dto.message, RETRIEVAL_LIMIT);
        const { answer, usedAi } = await this.aiChatService.answer(
            dto.message,
            dto.history ?? [],
            chunks,
        );

        return { answer, sources: this.toSources(chunks), usedAi };
    }

    /**
     * Ranks chunks by Turkish full-text relevance to the query, falling back to
     * an ILIKE keyword match when stemming yields no hits.
     */
    private async retrieve(
        query: string,
        limit: number,
    ): Promise<RetrievedChunk[]> {
        const trimmed = query.trim();
        if (!trimmed) {
            return [];
        }

        const ranked = await this.chunkRepository.query(
            `SELECT c."documentId" AS "documentId", d.title AS title, c.content AS content,
                    ts_rank(to_tsvector('${FTS_CONFIG}', c.content), plainto_tsquery('${FTS_CONFIG}', $1)) AS rank
             FROM knowledge_document_chunks c
             INNER JOIN knowledge_documents d ON d.id = c."documentId"
             WHERE to_tsvector('${FTS_CONFIG}', c.content) @@ plainto_tsquery('${FTS_CONFIG}', $1)
             ORDER BY rank DESC
             LIMIT $2`,
            [trimmed, limit],
        );

        if (ranked.length > 0) {
            return (ranked as RetrievedRow[]).map(this.toRetrievedChunk);
        }

        return this.keywordFallback(trimmed, limit);
    }

    private async keywordFallback(
        query: string,
        limit: number,
    ): Promise<RetrievedChunk[]> {
        const tokens = query
            .toLocaleLowerCase('tr-TR')
            .replace(/[^a-zçğıöşü0-9\s-]/gi, ' ')
            .split(/\s+/)
            .filter((token) => token.length > 2)
            .slice(0, 6);

        if (!tokens.length) {
            return [];
        }

        const patterns = tokens.map((token) => `%${token}%`);
        const rows = await this.chunkRepository.query(
            `SELECT c."documentId" AS "documentId", d.title AS title, c.content AS content
             FROM knowledge_document_chunks c
             INNER JOIN knowledge_documents d ON d.id = c."documentId"
             WHERE c.content ILIKE ANY($1)
             LIMIT $2`,
            [patterns, limit],
        );

        return (rows as RetrievedRow[]).map(this.toRetrievedChunk);
    }

    // ─── Chunking ───

    /**
     * Splits text into retrieval-sized chunks, preferring paragraph then
     * sentence boundaries so passages stay semantically coherent.
     */
    private chunkText(text: string): string[] {
        const clean = text
            .replace(/\r\n/g, '\n')
            .replace(/[^\S\n]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        const paragraphs = clean
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean);

        const chunks: string[] = [];
        let current = '';

        const flush = (): void => {
            const value = current.trim();
            if (value.length >= MIN_CHUNK_CHARS) {
                chunks.push(value);
            }
            current = '';
        };

        for (const paragraph of paragraphs) {
            if (paragraph.length > MAX_CHUNK_CHARS) {
                flush();
                for (const part of this.splitLongParagraph(paragraph)) {
                    chunks.push(part);
                }
                continue;
            }

            if (current && current.length + paragraph.length + 2 > MAX_CHUNK_CHARS) {
                flush();
            }
            current = current ? `${current}\n\n${paragraph}` : paragraph;
        }
        flush();

        return chunks;
    }

    private splitLongParagraph(paragraph: string): string[] {
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        const parts: string[] = [];
        let buffer = '';

        for (const sentence of sentences) {
            const candidate = buffer ? `${buffer} ${sentence}` : sentence;
            if (candidate.length > MAX_CHUNK_CHARS && buffer) {
                parts.push(buffer.trim());
                buffer = sentence;
            } else if (candidate.length > MAX_CHUNK_CHARS) {
                // A single sentence longer than the limit: hard-wrap it.
                for (let i = 0; i < candidate.length; i += MAX_CHUNK_CHARS) {
                    parts.push(candidate.slice(i, i + MAX_CHUNK_CHARS).trim());
                }
                buffer = '';
            } else {
                buffer = candidate;
            }
        }

        if (buffer.trim().length >= MIN_CHUNK_CHARS) {
            parts.push(buffer.trim());
        }
        return parts;
    }

    // ─── Mappers ───

    private toRetrievedChunk(row: RetrievedRow): RetrievedChunk {
        return {
            documentId: row.documentId,
            title: row.title,
            content: row.content,
        };
    }

    /** Collapses chunk hits into one source entry per document for the UI. */
    private toSources(chunks: RetrievedChunk[]): ChatSource[] {
        const seen = new Map<string, ChatSource>();
        for (const chunk of chunks) {
            if (seen.has(chunk.documentId)) {
                continue;
            }
            seen.set(chunk.documentId, {
                documentId: chunk.documentId,
                title: chunk.title,
                snippet: `${chunk.content.slice(0, SNIPPET_CHARS).trim()}…`,
            });
        }
        return [...seen.values()];
    }

    private toSummary(document: KnowledgeDocument): DocumentSummary {
        return {
            id: document.id,
            title: document.title,
            fileName: document.fileName,
            mimeType: document.mimeType,
            fileSize: document.fileSize,
            status: document.status,
            charCount: document.charCount,
            chunkCount: document.chunkCount,
            errorMessage: document.errorMessage,
            createdAt: document.createdAt,
        };
    }
}
