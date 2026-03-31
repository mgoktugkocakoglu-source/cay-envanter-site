import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSocialBusinessTables1774982609410 implements MigrationInterface {
    name = 'AddSocialBusinessTables1774982609410'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "job_listings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "authorId" uuid NOT NULL, "type" "public"."job_listings_type_enum" NOT NULL, "category" "public"."job_listings_category_enum" NOT NULL, "status" "public"."job_listings_status_enum" NOT NULL DEFAULT 'active', "location" character varying(255) NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ce5adead49e5fbf2df55e1917c1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_444cdcdbe46a06e62eb5eb990d" ON "job_listings" ("authorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b1ebf268bdf206cdad913f5aac" ON "job_listings" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_d7a48ba96a0034a0db2ae080fc" ON "job_listings" ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_924b81ab61636e544696be4cfc" ON "job_listings" ("status") `);
        await queryRunner.query(`CREATE TABLE "community_comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "postId" uuid NOT NULL, "userId" uuid NOT NULL, "content" character varying(500) NOT NULL, "likeCount" integer NOT NULL DEFAULT '0', "dislikeCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_bddaf18297fe4a6d1cd539586b3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ef3905ef22f1379a174d22c57f" ON "community_comments" ("postId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "community_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "content" text, "type" "public"."community_posts_type_enum" NOT NULL DEFAULT 'text', "mediaUrls" jsonb NOT NULL DEFAULT '[]', "likeCount" integer NOT NULL DEFAULT '0', "dislikeCount" integer NOT NULL DEFAULT '0', "commentCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_af0c0b33e03b933e3e48119f2e3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6fd09b54f00d8505d01d52478a" ON "community_posts" ("type", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ef75fad1463fa1fed0f0f1371" ON "community_posts" ("userId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "community_tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(50) NOT NULL, "displayName" character varying(100) NOT NULL, "usageCount" integer NOT NULL DEFAULT '0', "isSystem" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6b7cf10ab5d82ea3ea56a0aa646" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e796701c36fa62d600a9be9afa" ON "community_tags" ("name") `);
        await queryRunner.query(`CREATE TABLE "community_reactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "targetType" "public"."community_reactions_targettype_enum" NOT NULL, "targetId" uuid NOT NULL, "reactionType" "public"."community_reactions_reactiontype_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_cc13c6ddc91caffb5ddeaa7addc" UNIQUE ("userId", "targetType", "targetId"), CONSTRAINT "PK_2e146ef302d2e8421222402611e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_70e0dd701ced1d31294229fb9a" ON "community_reactions" ("targetType", "targetId") `);
        await queryRunner.query(`ALTER TABLE "job_listings" ADD CONSTRAINT "FK_444cdcdbe46a06e62eb5eb990df" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_comments" ADD CONSTRAINT "FK_8cd0b0aabf6e25d0d2f28af6ea4" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_comments" ADD CONSTRAINT "FK_40d88998dc1319955950df888ad" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_posts" ADD CONSTRAINT "FK_f9790963910a5c1e3c8684fe790" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_reactions" ADD CONSTRAINT "FK_7d563b835f3908a701100f07e7f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "community_post_tags" ADD CONSTRAINT "FK_8001d9b0f6e500827d59274b7c3" FOREIGN KEY ("postId") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "community_post_tags" ADD CONSTRAINT "FK_6ebdac95836bd34a0a4d6811bff" FOREIGN KEY ("tagId") REFERENCES "community_tags"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "community_post_tags" DROP CONSTRAINT "FK_6ebdac95836bd34a0a4d6811bff"`);
        await queryRunner.query(`ALTER TABLE "community_post_tags" DROP CONSTRAINT "FK_8001d9b0f6e500827d59274b7c3"`);
        await queryRunner.query(`ALTER TABLE "community_reactions" DROP CONSTRAINT "FK_7d563b835f3908a701100f07e7f"`);
        await queryRunner.query(`ALTER TABLE "community_posts" DROP CONSTRAINT "FK_f9790963910a5c1e3c8684fe790"`);
        await queryRunner.query(`ALTER TABLE "community_comments" DROP CONSTRAINT "FK_40d88998dc1319955950df888ad"`);
        await queryRunner.query(`ALTER TABLE "community_comments" DROP CONSTRAINT "FK_8cd0b0aabf6e25d0d2f28af6ea4"`);
        await queryRunner.query(`ALTER TABLE "job_listings" DROP CONSTRAINT "FK_444cdcdbe46a06e62eb5eb990df"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_70e0dd701ced1d31294229fb9a"`);
        await queryRunner.query(`DROP TABLE "community_reactions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e796701c36fa62d600a9be9afa"`);
        await queryRunner.query(`DROP TABLE "community_tags"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1ef75fad1463fa1fed0f0f1371"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6fd09b54f00d8505d01d52478a"`);
        await queryRunner.query(`DROP TABLE "community_posts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ef3905ef22f1379a174d22c57f"`);
        await queryRunner.query(`DROP TABLE "community_comments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_924b81ab61636e544696be4cfc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d7a48ba96a0034a0db2ae080fc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b1ebf268bdf206cdad913f5aac"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_444cdcdbe46a06e62eb5eb990d"`);
        await queryRunner.query(`DROP TABLE "job_listings"`);
    }

}
