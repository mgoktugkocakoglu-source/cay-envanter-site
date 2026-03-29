import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobListing } from './entities/job-listing.entity';
import { JobListingsService } from './job-listings.service';
import { JobListingsController } from './job-listings.controller';

@Module({
    imports: [TypeOrmModule.forFeature([JobListing])],
    controllers: [JobListingsController],
    providers: [JobListingsService],
    exports: [JobListingsService],
})
export class JobListingsModule {}
