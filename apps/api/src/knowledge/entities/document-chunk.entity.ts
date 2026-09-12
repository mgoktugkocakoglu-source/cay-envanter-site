import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { KnowledgeDocument } from '@/knowledge/entities/document.entity';

/**
 * A contiguous slice of a document's extracted text. Retrieval ranks these
 * rows with PostgreSQL full-text search and cosine similarity over the stored
 * embedding, then fuses both rankings before the passages reach the LLM.
 */
@Entity('knowledge_document_chunks')
export class KnowledgeDocumentChunk {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ type: 'uuid' })
    documentId: string;

    @ManyToOne(() => KnowledgeDocument, (document) => document.chunks, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'documentId' })
    document: KnowledgeDocument;

    @Column({ type: 'integer' })
    chunkIndex: number;

    /** 1-based page the chunk came from (PDF only); null when unknown. */
    @Column({ type: 'integer', nullable: true })
    pageNumber: number | null;

    @Column({ type: 'text' })
    content: string;

    /** Dense embedding of `content`; loaded explicitly by the retrieval cache. */
    @Column({ type: 'real', array: true, nullable: true, select: false })
    embedding: number[] | null;

    @CreateDateColumn()
    createdAt: Date;
}
