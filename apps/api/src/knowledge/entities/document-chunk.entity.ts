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
 * rows with PostgreSQL full-text search before they are fed to the LLM.
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

    @Column({ type: 'text' })
    content: string;

    @CreateDateColumn()
    createdAt: Date;
}
