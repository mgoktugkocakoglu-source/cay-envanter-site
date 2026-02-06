import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { GeoService } from '@/geo/geo.service';
import { ProvinceDto, DistrictDto, NeighborhoodDto, ParcelDto, ParcelDetailDto } from '@/geo/dto';

@ApiTags('Geo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('geo')
export class GeoController {
    constructor(private readonly geoService: GeoService) { }

    @Get('provinces')
    @ApiOperation({ summary: 'Get tea region provinces with boundaries' })
    @ApiResponse({ status: 200, description: 'List of provinces with polygon bounds' })
    async getProvinces(): Promise<ProvinceDto[]> {
        return this.geoService.getProvinces();
    }

    @Get('districts/:provinceId')
    @ApiOperation({ summary: 'Get districts for a province' })
    @ApiParam({ name: 'provinceId', description: 'Province ID from TKGM' })
    @ApiResponse({ status: 200, description: 'List of districts with polygon bounds' })
    async getDistricts(@Param('provinceId') provinceId: string): Promise<DistrictDto[]> {
        return this.geoService.getDistricts(provinceId);
    }

    @Get('neighborhoods/:districtId')
    @ApiOperation({ summary: 'Get neighborhoods for a district' })
    @ApiParam({ name: 'districtId', description: 'District ID from TKGM' })
    @ApiResponse({ status: 200, description: 'List of neighborhoods with polygon bounds' })
    async getNeighborhoods(@Param('districtId') districtId: string): Promise<NeighborhoodDto[]> {
        return this.geoService.getNeighborhoods(districtId);
    }

    @Get('parcels/:neighborhoodId')
    @ApiOperation({ summary: 'Get parcels for a neighborhood' })
    @ApiParam({ name: 'neighborhoodId', description: 'Neighborhood ID from TKGM' })
    @ApiResponse({ status: 200, description: 'List of parcels with polygon coordinates and area' })
    async getParcels(@Param('neighborhoodId') neighborhoodId: string): Promise<ParcelDto[]> {
        return this.geoService.getParcels(neighborhoodId);
    }

    @Get('parcel/:lat/:lng')
    @ApiOperation({ summary: 'Get parcel by coordinates' })
    @ApiParam({ name: 'lat', description: 'Latitude coordinate' })
    @ApiParam({ name: 'lng', description: 'Longitude coordinate' })
    @ApiResponse({ status: 200, description: 'Parcel details with polygon and properties' })
    @ApiResponse({ status: 404, description: 'No parcel found at coordinates' })
    async getParcelByCoordinates(
        @Param('lat') lat: string,
        @Param('lng') lng: string,
    ): Promise<ParcelDetailDto | null> {
        return this.geoService.getParcelByCoordinates(parseFloat(lat), parseFloat(lng));
    }
}
