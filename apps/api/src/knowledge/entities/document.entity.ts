import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    Index,
} from 'typeorm';
import { DocumentStatus } from '@/knowledge/enums';
import { KnowledgeDocumentChunk } from '@/knowledge/entities/document-chunk.entity';

/**
 * A document uploaded to the AI agent's knowledge base (PDF, DOCX, TXT, MD).
 * The extracted text is split into {@link KnowledgeDocumentChunk} rows that
 * back hybrid (full-text + vector) retrieval. The original file is kept so
 * users can open and download it: in Cloudflare R2 when configured
 * (`storageKey`), otherwise inline in Postgres (`fileData`).
 */
@Entity('knowledge_documents')
export class KnowledgeDocument {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ type: 'varchar', length: 255 })
    fileName: string;

    @Column({ type: 'varchar', length: 150 })
    mimeType: string;

    @Column({ type: 'integer', default: 0 })
    fileSize: number;

    @Column({ type: 'varchar', length: 20, default: DocumentStatus.Processing })
    status: DocumentStatus;

    @Column({ type: 'integer', default: 0 })
    charCount: number;

    @Column({ type: 'integer', default: 0 })
    chunkCount: number;

    /** Number of chunks that have a stored embedding vector. */
    @Column({ type: 'integer', default: 0 })
    embeddedChunkCount: number;

    /** Page count for paginated formats (PDF); 0 when unknown. */
    @Column({ type: 'integer', default: 0 })
    pageCount: number;

    /** Embedding model the chunk vectors were produced with; null if none. */
    @Column({ type: 'varchar', length: 100, nullable: true })
    embeddingModel: string | null;

    /** LLM-generated starter questions this document can answer. */
    @Column({ type: 'text', array: true, default: '{}' })
    suggestedQuestions: string[];

    /** Object key in R2 when the original file lives there. */
    @Column({ type: 'varchar', length: 512, nullable: true })
    storageKey: string | null;

    /** Original file bytes when R2 is not configured. Never loaded by default. */
    @Column({ type: 'bytea', nullable: true, select: false })
    fileData: Buffer | null;

    @Column({ type: 'text', nullable: true })
    errorMessage: string | null;

    @Index()
    @Column({ type: 'uuid', nullable: true })
    uploadedById: string | null;

    @OneToMany(() => KnowledgeDocumentChunk, (chunk) => chunk.document, {
        cascade: true,
    })
    chunks: KnowledgeDocumentChunk[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
