import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobListing } from './entities/job-listing.entity';
import { JobListingsService } from './job-listings.service';
import { JobListingsController } from './job-listings.controller';
import { JobListingsSchemaService } from './job-listings-schema.service';

@Module({
    imports: [TypeOrmModule.forFeature([JobListing])],
    controllers: [JobListingsController],
    providers: [JobListingsService, JobListingsSchemaService],
    exports: [JobListingsService],
})
export class JobListingsModule {}
