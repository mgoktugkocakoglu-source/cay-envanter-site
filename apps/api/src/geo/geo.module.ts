import { Module } from '@nestjs/common';
import { GeoController } from '@/geo/geo.controller';
import { GeoService } from '@/geo/geo.service';

@Module({
    controllers: [GeoController],
    providers: [GeoService],
    exports: [GeoService],
})
export class GeoModule { }
