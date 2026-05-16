import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from '@/users/entities/user.entity';
import {
    MarketplaceListingCategory,
    MarketplaceListingStatus,
} from '@/marketplace/enums/marketplace-listing.enum';

@Entity('marketplace_listings')
export class MarketplaceListing {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    @Index()
    sellerId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sellerId' })
    seller: User;

    @Column({
        type: 'enum',
        enum: MarketplaceListingCategory,
    })
    @Index()
    category: MarketplaceListingCategory;

    @Column({
        type: 'enum',
        enum: MarketplaceListingStatus,
        default: MarketplaceListingStatus.ACTIVE,
    })
    @Index()
    status: MarketplaceListingStatus;

    @Column({ type: 'varchar', length: 180 })
    title: string;

    @Column({ type: 'varchar', length: 255 })
    location: string;

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'int' })
    price: number;

    @Column({ type: 'varchar', length: 30, nullable: true })
    priceUnit: string | null;

    @Column({ type: 'varchar', length: 100 })
    contactName: string;

    @Column({ type: 'varchar', length: 25 })
    contactPhone: string;

    @Column({ type: 'jsonb', default: [] })
    imageUrls: string[];

    @Column({ type: 'jsonb', default: {} })
    specs: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
