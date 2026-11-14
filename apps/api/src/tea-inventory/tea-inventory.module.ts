import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/users/entities/user.entity';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import { TeaInventoryParcel } from '@/tea-inventory/entities/tea-inventory-parcel.entity';
import { TeaInventoryProducer } from '@/tea-inventory/entities/tea-inventory-producer.entity';
import { TeaInventoryGarden } from '@/tea-inventory/entities/tea-inventory-garden.entity';
import { PruningDecision } from '@/tea-inventory/entities/pruning-decision.entity';
import { TeaInventoryLicense } from '@/tea-inventory/entities/tea-inventory-license.entity';
import { ParcelLineage } from '@/tea-inventory/entities/parcel-lineage.entity';
import { LicensingApplication } from '@/tea-inventory/entities/licensing-application.entity';
import { LicensingDecision } from '@/tea-inventory/entities/licensing-decision.entity';
import { CalibrationLabel } from '@/tea-inventory/entities/calibration-label.entity';
import { MinistryRequest } from '@/tea-inventory/entities/ministry-request.entity';
import { FertilisationRecord } from '@/tea-inventory/entities/fertilisation-record.entity';
import { ProducerPruningService } from '@/tea-inventory/producer-pruning.service';
import { ProducerPruningController } from '@/tea-inventory/producer-pruning.controller';
import { LicensingService } from '@/tea-inventory/licensing.service';
import { LicensingController } from '@/tea-inventory/licensing.controller';
import { LicensingOperationsService } from '@/tea-inventory/licensing-operations.service';
import { PruningFusionService } from '@/tea-inventory/pruning-fusion.service';
import { PruningFusionController } from '@/tea-inventory/pruning-fusion.controller';
import { EvidenceService } from '@/tea-inventory/evidence.service';
import { SeasonReportService } from '@/tea-inventory/season-report.service';
import { ReportController } from '@/tea-inventory/report.controller';
import { MinistryRequestService } from '@/tea-inventory/ministry-request.service';
import { MinistryRequestController } from '@/tea-inventory/ministry-request.controller';
import { CalibrationService } from '@/tea-inventory/calibration.service';
import { CalibrationController } from '@/tea-inventory/calibration.controller';
import { GardenHealthService } from '@/tea-inventory/garden-health.service';
import { RegionOverviewService } from '@/tea-inventory/region-overview.service';
import { LandEvaluationService } from '@/tea-inventory/land-evaluation.service';
import { LandEvaluationController } from '@/tea-inventory/land-evaluation.controller';
import { GardenAgeService } from '@/tea-inventory/garden-age.service';
import { GardenAgeController } from '@/tea-inventory/garden-age.controller';
import { FieldTestService } from '@/tea-inventory/field-test.service';
import { FieldTestReportService } from '@/tea-inventory/field-test-report.service';
import { PixelScanService } from '@/tea-inventory/pixel-scan.service';
import { PixelScanController } from '@/tea-inventory/pixel-scan.controller';
import { PruningCombinedService } from '@/tea-inventory/pruning-combined.service';
import { PruningCombinedController } from '@/tea-inventory/pruning-combined.controller';
import { PruningWorklistService } from '@/tea-inventory/pruning-worklist.service';
import { LicenceAuditService } from '@/tea-inventory/licence-audit.service';
import { LicenceAuditController } from '@/tea-inventory/licence-audit.controller';
import { DroneVerificationService } from '@/tea-inventory/drone-verification.service';
import { DroneVerificationController } from '@/tea-inventory/drone-verification.controller';
import { FieldTestController } from '@/tea-inventory/field-test.controller';
import { GardenHealthController } from '@/tea-inventory/garden-health.controller';
import { TeaInventoryController } from '@/tea-inventory/tea-inventory.controller';
import { TeaInventoryService } from '@/tea-inventory/tea-inventory.service';
import { TeaInventorySeedService } from '@/tea-inventory/tea-inventory-seed.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            User,
            TeaInventoryArea,
            TeaInventoryParcel,
            TeaInventoryProducer,
            TeaInventoryGarden,
            PruningDecision,
            TeaInventoryLicense,
            ParcelLineage,
            LicensingApplication,
            LicensingDecision,
            CalibrationLabel,
            MinistryRequest,
            FertilisationRecord,
        ]),
    ],
    controllers: [TeaInventoryController, ProducerPruningController, LicensingController, PruningFusionController, ReportController, MinistryRequestController, CalibrationController, GardenHealthController, LandEvaluationController, GardenAgeController, FieldTestController, PixelScanController, PruningCombinedController, LicenceAuditController, DroneVerificationController],
    providers: [TeaInventoryService, TeaInventorySeedService, ProducerPruningService, LicensingService, LicensingOperationsService, PruningFusionService, EvidenceService, SeasonReportService, MinistryRequestService, CalibrationService, GardenHealthService, RegionOverviewService, LandEvaluationService, GardenAgeService, FieldTestService, FieldTestReportService, PixelScanService, PruningCombinedService, PruningWorklistService, LicenceAuditService, DroneVerificationService],
})
export class TeaInventoryModule { }
