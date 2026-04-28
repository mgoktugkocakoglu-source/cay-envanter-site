import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class JobListingsSchemaService implements OnApplicationBootstrap {
    constructor(private readonly dataSource: DataSource) {}

    async onApplicationBootstrap(): Promise<void> {
        await this.dataSource.query(`
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_listings_type_enum') THEN
                    CREATE TYPE job_listings_type_enum AS ENUM ('worker', 'job');
                END IF;

                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_listings_category_enum') THEN
                    CREATE TYPE job_listings_category_enum AS ENUM ('tea-picking', 'tea-transport', 'daily-jobs');
                END IF;

                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_listings_status_enum') THEN
                    CREATE TYPE job_listings_status_enum AS ENUM ('active', 'inactive', 'filled');
                END IF;
            END
            $$;

            CREATE TABLE IF NOT EXISTS job_listings (
                id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "authorId" uuid NOT NULL,
                type job_listings_type_enum NOT NULL,
                category job_listings_category_enum NOT NULL,
                status job_listings_status_enum NOT NULL DEFAULT 'active',
                location varchar(255) NOT NULL,
                metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
                "createdAt" timestamp NOT NULL DEFAULT now(),
                "updatedAt" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "FK_job_listings_authorId_users_id"
                    FOREIGN KEY ("authorId") REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS "IDX_job_listings_authorId" ON job_listings ("authorId");
            CREATE INDEX IF NOT EXISTS "IDX_job_listings_type" ON job_listings (type);
            CREATE INDEX IF NOT EXISTS "IDX_job_listings_category" ON job_listings (category);
            CREATE INDEX IF NOT EXISTS "IDX_job_listings_status" ON job_listings (status);
        `);
    }
}
