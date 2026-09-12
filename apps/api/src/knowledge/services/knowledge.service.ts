import {
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { Readable } from 'stream';
import {
    KnowledgeDocument,
    KnowledgeDocumentChunk,
} from '@/knowledge/entities';
import { DocumentStatus } from '@/knowledge/enums';
import {
    ChatDto,
    ChatResponse,
    ChatSource,
    ChatStreamEvent,
    DocumentSummary,
    KnowledgeStatus,
    RetrievalMode,
} from '@/knowledge/dto';
import {
    ExtractedPage,
    TextExtractionService,
} from '@/knowledge/services/text-extraction.service';
import {
    AiChatService,
    RetrievedChunk,
} from '@/knowledge/services/ai-chat.service';
import { EmbeddingService, dot } from '@/knowledge/services/embedding.service';
import { R2StorageService } from '@/uploads/r2-storage.service';

const MAX_CHUNK_CHARS = 1200;
const MIN_CHUNK_CHARS = 20;
const CANDIDATES_PER_RANKER = 12;
const RETRIEVAL_LIMIT = 6;
const SNIPPET_CHARS = 220;
/** Reciprocal-rank-fusion constant; 60 is the standard choice. */
const RRF_K = 60;
/** Vector-only hits below this cosine are treated as unrelated. */
const MIN_COSINE = 0.4;
/** Sample text sent to the LLM when generating starter questions. */
const QUESTION_SAMPLE_CHARS = 6000;

/** Postgres text-search configuration with Turkish stemming and stop words. */
const FTS_CONFIG = 'turkish';

interface ChunkRow {
    id: string;
    documentId: string;
    title: string;
    fileName: string;
    pageNumber: number | null;
    content: string;
}

interface VectorEntry {
    chunkId: string;
    vector: Float32Array;
}

interface ChunkDraft {
    content: string;
    pageNumber: number | null;
}

interface RetrievalResult {
    chunks: RetrievedChunk[];
    mode: RetrievalMode;
}

export interface StoredDocumentFile {
    fileName: string;
    mimeType: string;
    size: number;
    stream?: Readable;
    buffer?: Buffer;
}

/**
 * Owns the AI agent's knowledge base: ingesting uploaded documents (text,
 * page numbers, original file), hybrid retrieval (Turkish full-text search
 * fused with Gemini embeddings), and orchestrating grounded chat answers
 * through {@link AiChatService}.
 */
@Injectable()
export class KnowledgeService implements OnModuleInit {
    private readonly logger = new Logger(KnowledgeService.name);
    /** In-memory copy of every chunk embedding; rebuilt lazily after writes. */
    private vectorCache: VectorEntry[] | null = null;
    private vectorCacheLoading: Promise<VectorEntry[]> | null = null;

    constructor(
        @InjectRepository(KnowledgeDocument)
        private readonly documentRepository: Repository<KnowledgeDocument>,
        @InjectRepository(KnowledgeDocumentChunk)
        private readonly chunkRepository: Repository<KnowledgeDocumentChunk>,
        private readonly textExtractionService: TextExtractionService,
        private readonly aiChatService: AiChatService,
        private readonly embeddingService: EmbeddingService,
        private readonly storageService: R2StorageService,
    ) {}

    /**
     * Creates the full-text index and resumes any document whose background
     * indexing was interrupted by a restart. Failures are non-fatal.
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

        const interrupted = await this.documentRepository.find({
            where: { status: DocumentStatus.Processing },
            select: ['id'],
        });
        for (const document of interrupted) {
            void this.enrichDocument(document.id);
        }
    }

    // ─── Documents ───

    async findAll(): Promise<DocumentSummary[]> {
        const [documents, inlineFileIds] = await Promise.all([
            this.documentRepository.find({ order: { createdAt: 'DESC' } }),
            this.findInlineFileIds(),
        ]);
        return documents.map((document) =>
            this.toSummary(document, inlineFileIds.has(document.id)),
        );
    }

    async createFromFile(
        file: Express.Multer.File,
        title: string | undefined,
        userId: string,
    ): Promise<DocumentSummary> {
        const extracted = await this.textExtractionService.extract(file);
        const meaningfulLength = extracted.text.replace(/\s/g, '').length;

        if (meaningfulLength < MIN_CHUNK_CHARS) {
            throw new BadRequestException(
                'Dosyadan okunabilir metin çıkarılamadı. Taranmış (resim) bir PDF ise metin içeren bir sürüm yükleyin.',
            );
        }

        const drafts = extracted.pages.length
            ? this.chunkPages(extracted.pages)
            : this.chunkText(extracted.text).map((content) => ({
                  content,
                  pageNumber: null,
              }));

        if (!drafts.length) {
            throw new BadRequestException(
                'Belge metni indekslenebilecek kadar uzun değil.',
            );
        }

        const mimeType = (file.mimetype || 'application/octet-stream').slice(0, 150);
        const storageKey = await this.storeOriginal(file, mimeType);

        const document = this.documentRepository.create({
            title: (title?.trim() || file.originalname).slice(0, 255),
            fileName: file.originalname.slice(0, 255),
            mimeType,
            fileSize: file.size ?? 0,
            status: DocumentStatus.Processing,
            charCount: extracted.text.trim().length,
            chunkCount: drafts.length,
            embeddedChunkCount: 0,
            pageCount: extracted.pageCount,
            embeddingModel: null,
            suggestedQuestions: [],
            storageKey,
            fileData: storageKey ? null : file.buffer,
            errorMessage: null,
            uploadedById: userId ?? null,
            chunks: drafts.map((draft, index) =>
                this.chunkRepository.create({
                    chunkIndex: index,
                    pageNumber: draft.pageNumber,
                    content: draft.content,
                }),
            ),
        });

        const saved = await this.documentRepository.save(document);
        this.logger.log(
            `Indexed document "${saved.title}" (${saved.chunkCount} chunks, ${saved.pageCount} pages, ${saved.charCount} chars)`,
        );

        // Embeddings and starter questions are produced in the background so
        // the upload request returns as soon as the text is searchable.
        void this.enrichDocument(saved.id);

        return this.toSummary(saved, !storageKey);
    }

    /** Re-runs embedding + starter-question generation for one document. */
    async reindex(id: string): Promise<DocumentSummary> {
        const document = await this.documentRepository.findOne({ where: { id } });
        if (!document) {
            throw new NotFoundException('Belge bulunamadı.');
        }
        document.status = DocumentStatus.Processing;
        document.errorMessage = null;
        await this.documentRepository.save(document);
        void this.enrichDocument(id);
        return this.toSummary(document, await this.hasInlineFile(id));
    }

    /** Queues every document for re-embedding; returns how many were queued. */
    async reindexAll(): Promise<number> {
        const documents = await this.documentRepository.find({ select: ['id'] });
        await this.documentRepository.update(
            {},
            { status: DocumentStatus.Processing, errorMessage: null },
        );
        for (const document of documents) {
            void this.enrichDocument(document.id);
        }
        return documents.length;
    }

    async remove(id: string): Promise<void> {
        const document = await this.documentRepository.findOne({ where: { id } });
        if (!document) {
            throw new NotFoundException('Belge bulunamadı.');
        }

        await this.documentRepository.delete(id);
        this.vectorCache = null;

        if (document.storageKey) {
            try {
                await this.storageService.deleteObject(document.storageKey);
            } catch (error) {
                this.logger.warn(
                    `Could not delete R2 object ${document.storageKey}: ${error}`,
                );
            }
        }
    }

    /** Loads the original file for opening/downloading. */
    async getFile(id: string): Promise<StoredDocumentFile> {
        const document = await this.documentRepository.findOne({ where: { id } });
        if (!document) {
            throw new NotFoundException('Belge bulunamadı.');
        }

        const base = {
            fileName: document.fileName,
            mimeType: document.mimeType,
            size: document.fileSize,
        };

        if (document.storageKey) {
            const object = await this.storageService.getObject(document.storageKey);
            return {
                ...base,
                size: object.contentLength ?? document.fileSize,
                stream: object.stream,
            };
        }

        const withData = await this.documentRepository
            .createQueryBuilder('document')
            .addSelect('document.fileData')
            .where('document.id = :id', { id })
            .getOne();

        if (!withData?.fileData) {
            throw new NotFoundException(
                'Bu belgenin orijinal dosyası saklanmamış. Yeniden yüklenmesi gerekir.',
            );
        }

        return { ...base, size: withData.fileData.length, buffer: withData.fileData };
    }

    async getStatus(): Promise<KnowledgeStatus> {
        const [documentCount, readyDocumentCount, chunkCount, aggregates] =
            await Promise.all([
                this.documentRepository.count(),
                this.documentRepository.count({
                    where: { status: DocumentStatus.Ready },
                }),
                this.chunkRepository.count(),
                this.documentRepository
                    .createQueryBuilder('document')
                    .select('COALESCE(SUM(document.embeddedChunkCount), 0)', 'embedded')
                    .addSelect('COALESCE(SUM(document.pageCount), 0)', 'pages')
                    .getRawOne<{ embedded: string; pages: string }>(),
            ]);

        return {
            aiConfigured: this.aiChatService.isConfigured,
            model: this.aiChatService.modelName,
            embeddingModel: this.embeddingService.modelName,
            fileStorage: this.storageService.isConfigured ? 'r2' : 'database',
            documentCount,
            readyDocumentCount,
            chunkCount,
            embeddedChunkCount: Number(aggregates?.embedded ?? 0),
            pageCount: Number(aggregates?.pages ?? 0),
        };
    }

    // ─── Chat ───

    async chat(dto: ChatDto): Promise<ChatResponse> {
        const history = dto.history ?? [];
        const question = await this.aiChatService.condenseQuestion(dto.message, history);
        const { chunks, mode } = await this.retrieve(question);

        if (!this.aiChatService.isConfigured || !chunks.length) {
            return {
                answer: this.aiChatService.buildFallbackAnswer(chunks),
                sources: this.toSources(chunks),
                usedAi: false,
                retrievalMode: mode,
                followUps: [],
            };
        }

        try {
            const answer = await this.aiChatService.answer(dto.message, history, chunks);
            const followUps = await this.aiChatService.suggestFollowUps(question, answer, chunks);
            return {
                answer,
                sources: this.toSources(chunks),
                usedAi: true,
                retrievalMode: mode,
                followUps,
            };
        } catch (error) {
            this.logger.warn(`Gemini chat request failed: ${error}`);
            return {
                answer: this.aiChatService.buildFallbackAnswer(chunks),
                sources: this.toSources(chunks),
                usedAi: false,
                retrievalMode: mode,
                followUps: [],
            };
        }
    }

    /**
     * Streaming variant of {@link chat}: emits `meta` (sources) first, then
     * `delta` fragments, then `done`. Never throws; failures become an
     * `error` event or a retrieval-only answer.
     */
    async chatStream(
        dto: ChatDto,
        emit: (event: ChatStreamEvent) => void,
        signal?: AbortSignal,
    ): Promise<void> {
        const history = dto.history ?? [];
        const question = await this.aiChatService.condenseQuestion(dto.message, history);
        const { chunks, mode } = await this.retrieve(question);
        const sources = this.toSources(chunks);

        if (signal?.aborted) {
            return;
        }

        if (!this.aiChatService.isConfigured || !chunks.length) {
            const answer = this.aiChatService.buildFallbackAnswer(chunks);
            emit({ type: 'meta', sources, retrievalMode: mode, usedAi: false });
            emit({ type: 'delta', text: answer });
            emit({ type: 'done', answer, followUps: [] });
            return;
        }

        emit({ type: 'meta', sources, retrievalMode: mode, usedAi: true });

        let streamed = '';
        try {
            const answer = await this.aiChatService.streamAnswer(
                dto.message,
                history,
                chunks,
                (text) => {
                    streamed += text;
                    emit({ type: 'delta', text });
                },
                signal,
            );
            if (signal?.aborted) {
                return;
            }
            const followUps = await this.aiChatService.suggestFollowUps(question, answer, chunks);
            emit({ type: 'done', answer, followUps });
        } catch (error) {
            if (signal?.aborted) {
                return;
            }
            this.logger.warn(`Gemini streaming request failed: ${error}`);
            if (streamed) {
                emit({ type: 'error', message: 'Yanıt tamamlanamadı. Lütfen tekrar deneyin.' });
                return;
            }
            const answer = this.aiChatService.buildFallbackAnswer(chunks);
            emit({ type: 'delta', text: answer });
            emit({ type: 'done', answer, followUps: [] });
        }
    }

    // ─── Retrieval ───

    /**
     * Hybrid retrieval: Turkish full-text rank and embedding cosine similarity
     * are each turned into a ranked list, then fused with reciprocal rank
     * fusion so a chunk that both rankers like rises to the top.
     */
    private async retrieve(query: string): Promise<RetrievalResult> {
        const trimmed = query.trim();
        if (!trimmed) {
            return { chunks: [], mode: 'none' };
        }

        const [ftsIds, vectorIds] = await Promise.all([
            this.searchFullText(trimmed),
            this.searchVectors(trimmed),
        ]);

        const fused = new Map<string, number>();
        const addRanking = (ids: string[]): void => {
            ids.forEach((id, rank) => {
                fused.set(id, (fused.get(id) ?? 0) + 1 / (RRF_K + rank + 1));
            });
        };
        addRanking(ftsIds);
        addRanking(vectorIds !== null ? vectorIds : []);

        if (!fused.size) {
            return { chunks: [], mode: 'none' };
        }

        const maxScore = 2 / (RRF_K + 1);
        const top = [...fused.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, RETRIEVAL_LIMIT);

        const rows = await this.loadChunkRows(top.map(([id]) => id));
        const byId = new Map(rows.map((row) => [row.id, row]));

        const chunks = top
            .map(([id, score]) => {
                const row = byId.get(id);
                return row ? this.toRetrievedChunk(row, score / maxScore) : null;
            })
            .filter((chunk): chunk is RetrievedChunk => chunk !== null);

        return { chunks, mode: vectorIds !== null ? 'hybrid' : 'keyword' };
    }

    /** Ranks chunks by Turkish full-text relevance; keyword ILIKE as fallback. */
    private async searchFullText(query: string): Promise<string[]> {
        const ranked = (await this.chunkRepository.query(
            `SELECT c.id
             FROM knowledge_document_chunks c
             WHERE to_tsvector('${FTS_CONFIG}', c.content) @@ plainto_tsquery('${FTS_CONFIG}', $1)
             ORDER BY ts_rank(to_tsvector('${FTS_CONFIG}', c.content), plainto_tsquery('${FTS_CONFIG}', $1)) DESC
             LIMIT $2`,
            [query, CANDIDATES_PER_RANKER],
        )) as Array<{ id: string }>;

        if (ranked.length) {
            return ranked.map((row) => row.id);
        }

        const tokens = query
            .toLocaleLowerCase('tr-TR')
            .replace(/[^a-zçğıöşü0-9\s-]/gi, ' ')
            .split(/\s+/)
            .filter((token) => token.length > 2)
            .slice(0, 6);
        if (!tokens.length) {
            return [];
        }

        const rows = (await this.chunkRepository.query(
            `SELECT c.id
             FROM knowledge_document_chunks c
             WHERE c.content ILIKE ANY($1)
             LIMIT $2`,
            [tokens.map((token) => `%${token}%`), CANDIDATES_PER_RANKER],
        )) as Array<{ id: string }>;
        return rows.map((row) => row.id);
    }

    /**
     * Ranks chunks by cosine similarity to the query embedding. Returns null
     * when embeddings are unavailable so the caller can report keyword mode.
     */
    private async searchVectors(query: string): Promise<string[] | null> {
        const queryVector = await this.embeddingService.embedQuery(query);
        if (!queryVector) {
            return null;
        }

        const entries = await this.loadVectorCache();
        if (!entries.length) {
            return null;
        }

        const scored: Array<{ chunkId: string; score: number }> = [];
        for (const entry of entries) {
            const score = dot(entry.vector, queryVector);
            if (score >= MIN_COSINE) {
                scored.push({ chunkId: entry.chunkId, score });
            }
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, CANDIDATES_PER_RANKER).map((item) => item.chunkId);
    }

    private loadVectorCache(): Promise<VectorEntry[]> {
        if (this.vectorCache) {
            return Promise.resolve(this.vectorCache);
        }
        if (!this.vectorCacheLoading) {
            this.vectorCacheLoading = (async () => {
                const rows = (await this.chunkRepository.query(
                    `SELECT id, embedding FROM knowledge_document_chunks WHERE embedding IS NOT NULL`,
                )) as Array<{ id: string; embedding: number[] | string }>;
                const entries = rows.map((row) => ({
                    chunkId: row.id,
                    vector: Float32Array.from(parseVector(row.embedding)),
                }));
                this.vectorCache = entries;
                this.vectorCacheLoading = null;
                return entries;
            })().catch((error) => {
                this.vectorCacheLoading = null;
                this.logger.warn(`Could not load embedding cache: ${error}`);
                return [];
            });
        }
        return this.vectorCacheLoading;
    }

    private async loadChunkRows(ids: string[]): Promise<ChunkRow[]> {
        if (!ids.length) {
            return [];
        }
        const chunks = await this.chunkRepository.find({
            where: { id: In(ids) },
            relations: { document: true },
        });
        return chunks.map((chunk) => ({
            id: chunk.id,
            documentId: chunk.documentId,
            title: chunk.document?.title ?? '',
            fileName: chunk.document?.fileName ?? '',
            pageNumber: chunk.pageNumber,
            content: chunk.content,
        }));
    }

    // ─── Background enrichment ───

    /**
     * Embeds every chunk of a document and generates starter questions, then
     * marks it ready. Keyword retrieval keeps working while this runs, and if
     * Gemini is unavailable the document simply stays keyword-only.
     */
    private async enrichDocument(documentId: string): Promise<void> {
        const document = await this.documentRepository.findOne({
            where: { id: documentId },
        });
        if (!document) {
            return;
        }

        if (!this.embeddingService.isConfigured) {
            await this.documentRepository.update(documentId, {
                status: DocumentStatus.Ready,
                errorMessage: null,
            });
            return;
        }

        const chunks = await this.chunkRepository.find({
            where: { documentId },
            order: { chunkIndex: 'ASC' },
        });

        let embeddedCount = 0;
        let errorMessage: string | null = null;
        try {
            const vectors = await this.embeddingService.embedDocuments(
                chunks.map((chunk) => chunk.content),
            );
            await Promise.all(
                chunks.map((chunk, index) =>
                    this.chunkRepository.update(chunk.id, { embedding: vectors[index] }),
                ),
            );
            embeddedCount = vectors.length;
            this.vectorCache = null;
        } catch (error) {
            this.logger.warn(`Embedding failed for document ${documentId}: ${error}`);
            errorMessage =
                'Anlamsal indeksleme başarısız oldu; belge yalnızca anahtar kelimeyle aranıyor. Yeniden indekslemeyi deneyin.';
        }

        const sample = chunks
            .slice(0, 8)
            .map((chunk) => chunk.content)
            .join('\n\n')
            .slice(0, QUESTION_SAMPLE_CHARS);
        const suggestedQuestions =
            document.suggestedQuestions.length && embeddedCount === 0
                ? document.suggestedQuestions
                : await this.aiChatService.suggestDocumentQuestions(document.title, sample);

        await this.documentRepository.update(documentId, {
            status: DocumentStatus.Ready,
            embeddedChunkCount: embeddedCount,
            embeddingModel: embeddedCount ? this.embeddingService.modelName : null,
            suggestedQuestions: suggestedQuestions.length
                ? suggestedQuestions
                : document.suggestedQuestions,
            errorMessage,
        });

        this.logger.log(
            `Enriched document "${document.title}" (${embeddedCount}/${chunks.length} chunks embedded, ${suggestedQuestions.length} starter questions)`,
        );
    }

    // ─── File storage ───

    /** Uploads the original to R2 when configured; returns the key or null for inline storage. */
    private async storeOriginal(
        file: Express.Multer.File,
        mimeType: string,
    ): Promise<string | null> {
        if (!this.storageService.isConfigured) {
            return null;
        }
        try {
            return await this.storageService.putBuffer(
                file.buffer,
                'documents',
                file.originalname,
                mimeType,
            );
        } catch (error) {
            this.logger.warn(`R2 upload failed, storing document inline: ${error}`);
            return null;
        }
    }

    private async findInlineFileIds(): Promise<Set<string>> {
        const rows = (await this.documentRepository.query(
            `SELECT id FROM knowledge_documents WHERE "fileData" IS NOT NULL`,
        )) as Array<{ id: string }>;
        return new Set(rows.map((row) => row.id));
    }

    private async hasInlineFile(id: string): Promise<boolean> {
        const rows = (await this.documentRepository.query(
            `SELECT 1 FROM knowledge_documents WHERE id = $1 AND "fileData" IS NOT NULL`,
            [id],
        )) as unknown[];
        return rows.length > 0;
    }

    // ─── Chunking ───

    /** Chunks each page separately so every chunk carries its page number. */
    private chunkPages(pages: ExtractedPage[]): ChunkDraft[] {
        const drafts: ChunkDraft[] = [];
        for (const page of pages) {
            for (const content of this.chunkText(page.text)) {
                drafts.push({ content, pageNumber: page.pageNumber });
            }
        }
        return drafts;
    }

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

    private toRetrievedChunk(row: ChunkRow, score: number): RetrievedChunk {
        return {
            chunkId: row.id,
            documentId: row.documentId,
            title: row.title,
            fileName: row.fileName,
            pageNumber: row.pageNumber,
            content: row.content,
            score: Math.round(Math.min(1, Math.max(0, score)) * 100) / 100,
        };
    }

    /** One source per retrieved chunk; `index` matches the `[n]` citations. */
    private toSources(chunks: RetrievedChunk[]): ChatSource[] {
        return chunks.map((chunk, index) => ({
            index: index + 1,
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            title: chunk.title,
            fileName: chunk.fileName,
            pageNumber: chunk.pageNumber,
            snippet: `${chunk.content.slice(0, SNIPPET_CHARS).trim()}…`,
            score: chunk.score,
        }));
    }

    private toSummary(document: KnowledgeDocument, hasInlineFile: boolean): DocumentSummary {
        return {
            id: document.id,
            title: document.title,
            fileName: document.fileName,
            mimeType: document.mimeType,
            fileSize: document.fileSize,
            status: document.status,
            charCount: document.charCount,
            chunkCount: document.chunkCount,
            embeddedChunkCount: document.embeddedChunkCount ?? 0,
            pageCount: document.pageCount ?? 0,
            hasFile: !!document.storageKey || hasInlineFile,
            suggestedQuestions: document.suggestedQuestions ?? [],
            errorMessage: document.errorMessage,
            createdAt: document.createdAt,
        };
    }
}

/** node-postgres returns real[] as numbers, but tolerate the `{1,2}` text form. */
function parseVector(value: number[] | string): number[] {
    if (Array.isArray(value)) {
        return value;
    }
    return value
        .replace(/^\{|\}$/g, '')
        .split(',')
        .map(Number);
}
