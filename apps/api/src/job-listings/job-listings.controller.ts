import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { JobListingsService } from './job-listings.service';
import { CreateJobListingDto } from './dto/create-job-listing.dto';
import { UpdateJobListingDto } from './dto/update-job-listing.dto';
import { QueryJobListingDto } from './dto/query-job-listing.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';

@ApiTags('İş ve İşçi İlanları')
@Controller('job-listings')
export class JobListingsController {
    constructor(private readonly jobListingsService: JobListingsService) {}

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Yeni ilan oluştur' })
    @ApiResponse({ status: 201, description: 'İlan başarıyla oluşturuldu.' })
    create(
        @CurrentUser('id') userId: string,
        @Body() createJobListingDto: CreateJobListingDto,
    ) {
        return this.jobListingsService.create(userId, createJobListingDto);
    }

    @Get()
    @ApiOperation({ summary: 'İlanları filtrele ve listele' })
    @ApiResponse({ status: 200, description: 'İlan listesi başarıyla getirildi.' })
    findAll(@Query() query: QueryJobListingDto) {
        return this.jobListingsService.findAll(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Tekil ilan detayı getir' })
    @ApiResponse({ status: 200, description: 'İlan başarıyla getirildi.' })
    findOne(@Param('id') id: string) {
        return this.jobListingsService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'İlanı güncelle' })
    @ApiResponse({ status: 200, description: 'İlan başarıyla güncellendi.' })
    update(
        @CurrentUser('id') userId: string,
        @Param('id') id: string,
        @Body() updateJobListingDto: UpdateJobListingDto,
    ) {
        return this.jobListingsService.update(userId, id, updateJobListingDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'İlanı sil' })
    @ApiResponse({ status: 200, description: 'İlan başarıyla silindi.' })
    remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
        return this.jobListingsService.remove(userId, id);
    }
}
