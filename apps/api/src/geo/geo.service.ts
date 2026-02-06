import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProvinceDto, DistrictDto, NeighborhoodDto, ParcelDto, ParcelDetailDto } from '@/geo/dto';

interface TkgmFeature {
    type: string;
    geometry: {
        type: string;
        coordinates: number[][][];
    };
    properties: {
        text: string;
        id: string;
        [key: string]: unknown;
    };
}

interface TkgmResponse {
    features: TkgmFeature[];
}

@Injectable()
export class GeoService {
    private readonly logger = new Logger(GeoService.name);
    private readonly TKGM_BASE_URL = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api';

    // Tea region provinces (Rize, Trabzon, Artvin, Giresun, Ordu)
    private readonly TEA_REGION_PROVINCES = [
        'Rize',
        'Trabzon',
        'Artvin',
        'Giresun',
        'Ordu',
    ];

    // Cache for province data (static, rarely changes)
    private provincesCache: ProvinceDto[] | null = null;
    private districtCache = new Map<string, DistrictDto[]>();
    private neighborhoodCache = new Map<string, NeighborhoodDto[]>();

    constructor(private readonly configService: ConfigService) { }

    async getProvinces(): Promise<ProvinceDto[]> {
        if (this.provincesCache) {
            return this.provincesCache;
        }

        try {
            const response = await fetch(`${this.TKGM_BASE_URL}/maksIdariYapi/illiste`);

            if (!response.ok) {
                throw new HttpException(
                    'Failed to fetch provinces from TKGM API',
                    HttpStatus.BAD_GATEWAY,
                );
            }

            const data = await response.json() as TkgmResponse;

            this.provincesCache = data.features
                .filter((feature) => this.TEA_REGION_PROVINCES.includes(feature.properties.text))
                .map((feature) => ({
                    id: feature.properties.id,
                    name: feature.properties.text,
                    bounds: feature.geometry.coordinates,
                }));

            this.logger.log(`Fetched ${this.provincesCache.length} tea region provinces`);
            return this.provincesCache;
        } catch (error) {
            this.logger.error('Error fetching provinces', error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Failed to connect to cadastre service',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    async getDistricts(provinceId: string): Promise<DistrictDto[]> {
        const cacheKey = provinceId;
        if (this.districtCache.has(cacheKey)) {
            return this.districtCache.get(cacheKey)!;
        }

        try {
            const response = await fetch(
                `${this.TKGM_BASE_URL}/maksIdariYapi/ilceliste/${provinceId}`,
            );

            if (!response.ok) {
                throw new HttpException(
                    'Failed to fetch districts from TKGM API',
                    HttpStatus.BAD_GATEWAY,
                );
            }

            const data = await response.json() as TkgmResponse;

            const districts: DistrictDto[] = data.features.map((feature) => ({
                id: feature.properties.id,
                name: feature.properties.text,
                bounds: feature.geometry.coordinates,
            }));

            this.districtCache.set(cacheKey, districts);
            this.logger.log(`Fetched ${districts.length} districts for province ${provinceId}`);
            return districts;
        } catch (error) {
            this.logger.error(`Error fetching districts for province ${provinceId}`, error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Failed to connect to cadastre service',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    async getNeighborhoods(districtId: string): Promise<NeighborhoodDto[]> {
        const cacheKey = districtId;
        if (this.neighborhoodCache.has(cacheKey)) {
            return this.neighborhoodCache.get(cacheKey)!;
        }

        try {
            const response = await fetch(
                `${this.TKGM_BASE_URL}/maksIdariYapi/mahalleliste/${districtId}`,
            );

            if (!response.ok) {
                throw new HttpException(
                    'Failed to fetch neighborhoods from TKGM API',
                    HttpStatus.BAD_GATEWAY,
                );
            }

            const data = await response.json() as TkgmResponse;

            const neighborhoods: NeighborhoodDto[] = data.features.map((feature) => ({
                id: feature.properties.id,
                name: feature.properties.text,
                bounds: feature.geometry.coordinates,
            }));

            this.neighborhoodCache.set(cacheKey, neighborhoods);
            this.logger.log(`Fetched ${neighborhoods.length} neighborhoods for district ${districtId}`);
            return neighborhoods;
        } catch (error) {
            this.logger.error(`Error fetching neighborhoods for district ${districtId}`, error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Failed to connect to cadastre service',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    async getParcels(neighborhoodId: string): Promise<ParcelDto[]> {
        try {
            const response = await fetch(
                `${this.TKGM_BASE_URL}//maksIdariYapi/yolliste/${neighborhoodId}`,
            );

            if (!response.ok) {
                throw new HttpException(
                    'Failed to fetch parcels from TKGM API',
                    HttpStatus.BAD_GATEWAY,
                );
            }

            const data = await response.json() as TkgmResponse;

            const parcels: ParcelDto[] = data.features.map((feature) => ({
                id: feature.properties.id,
                parcelNo: feature.properties.text || String(feature.properties['parselNo'] || ''),
                polygon: feature.geometry.coordinates,
                area: Number(feature.properties['alan'] || 0),
            }));

            this.logger.log(`Fetched ${parcels.length} parcels for neighborhood ${neighborhoodId}`);
            return parcels;
        } catch (error) {
            this.logger.error(`Error fetching parcels for neighborhood ${neighborhoodId}`, error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Failed to connect to cadastre service',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    async getParcelByCoordinates(lat: number, lng: number): Promise<ParcelDetailDto | null> {
        try {
            const response = await fetch(
                `${this.TKGM_BASE_URL}/parsel/${lat}/${lng}/`,
            );

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new HttpException(
                    'Failed to fetch parcel from TKGM API',
                    HttpStatus.BAD_GATEWAY,
                );
            }

            const data = await response.json() as {
                type: string;
                geometry: { type: string; coordinates: number[][][] };
                properties: Record<string, unknown>;
            };

            if (!data || !data.geometry) {
                return null;
            }

            const result: ParcelDetailDto = {
                polygon: data.geometry.coordinates,
                properties: {
                    ilAd: String(data.properties['ilAd'] || ''),
                    ilceAd: String(data.properties['ilceAd'] || ''),
                    mahalleAd: String(data.properties['mahalleAd'] || ''),
                    parselNo: String(data.properties['parselNo'] || ''),
                    adaNo: String(data.properties['adaNo'] || ''),
                    alan: String(data.properties['alan'] || ''),
                    nitelik: String(data.properties['nitelik'] || ''),
                    ozet: String(data.properties['ozet'] || ''),
                    pafta: String(data.properties['pafta'] || ''),
                    mevkii: String(data.properties['mevkii'] || ''),
                    ilId: Number(data.properties['ilId'] || 0),
                    ilceId: Number(data.properties['ilceId'] || 0),
                    mahalleId: Number(data.properties['mahalleId'] || 0),
                },
            };

            this.logger.log(`Fetched parcel at coordinates ${lat}, ${lng}`);
            return result;
        } catch (error) {
            this.logger.error(`Error fetching parcel at coordinates ${lat}, ${lng}`, error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Failed to connect to cadastre service',
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }
    }

    clearCache(): void {
        this.provincesCache = null;
        this.districtCache.clear();
        this.neighborhoodCache.clear();
        this.logger.log('Geo cache cleared');
    }
}
