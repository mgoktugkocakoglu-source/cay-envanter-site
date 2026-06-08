import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '@/users/entities/user.entity';
import { Role, UserType } from '@/auth/enums';
import { Firm } from '@/firms/entities/firm.entity';
import { FirmTariff, PaymentTerm } from '@/firms/entities/firm-tariff.entity';
import { Field } from '@/fields/entities/field.entity';
import { Payment } from '@/payments/entities/payment.entity';
import { Harvest } from '@/harvests/entities/harvest.entity';
import { PaymentHarvest } from '@/payments/entities/payment-harvest.entity';

interface TariffSeed {
    paymentTerm: PaymentTerm;
    pricePerKg: number;
    paymentMonth?: number;
}

interface FirmSeed {
    name: string;
    description: string;
    isCaykur: boolean;
    tariffs: TariffSeed[];
}

interface DeliverySeed {
    date: string;
    firm: 'caykur' | 'ofcay';
    kg: number;
    status: 'received' | 'pending';
    assignTo: number | null; // index into the user's fields, or null = unassigned
}

const CAYKUR_PRICE = 33.0;
const OFCAY_PRICE = 30.0;

const FIRM_SEEDS: FirmSeed[] = [
    {
        name: 'ÇAYKUR',
        description: 'İktisadi Devlet Teşekküllü Çay Firması',
        isCaykur: true,
        tariffs: [{ paymentTerm: 'cash', pricePerKg: CAYKUR_PRICE }],
    },
    {
        name: 'OFÇAY',
        description: 'Efor Holding Bünyesinde Faaliyet Gösteren Yerli Özel Firma',
        isCaykur: false,
        tariffs: [{ paymentTerm: 'cash', pricePerKg: OFCAY_PRICE }],
    },
    {
        name: 'ÖZGÜR ÇAY',
        description: 'Öz-Gür Çay Sanayi A.Ş. Bünyesinde Yerli ve Özel Firma',
        isCaykur: false,
        tariffs: [
            { paymentTerm: 'cash', pricePerKg: 29.0 },
            { paymentTerm: 'weekly', pricePerKg: 30.0 },
            { paymentTerm: 'monthly', pricePerKg: 32.0, paymentMonth: 10 },
        ],
    },
];

// Demo lands as if loaded from the Çaykur/TKGM database by cüzdan no.
// One land is intentionally left unnamed to showcase the "İsimlendir" flow.
const FIELD_SEEDS = [
    { name: 'Merkez Bahçe', district: 'Merkez', neighborhood: 'Çarşı', parcelNo: '11', adaNo: '142', area: 2150.5, lng: 40.5219, lat: 41.0201 },
    { name: 'Çayeli Üst Tarla', district: 'Çayeli', neighborhood: 'Yalı', parcelNo: '48', adaNo: '203', area: 3820.0, lng: 40.7361, lat: 41.0556 },
    { name: '', district: 'Pazar', neighborhood: 'Sahil', parcelNo: '17', adaNo: '95', area: 1290.75, lng: 40.8847, lat: 41.1792 },
];

const DELIVERY_SEEDS: DeliverySeed[] = [
    { date: '2025-06-10', firm: 'caykur', kg: 260, status: 'received', assignTo: 0 },
    { date: '2025-07-20', firm: 'caykur', kg: 300, status: 'received', assignTo: 1 },
    { date: '2026-05-18', firm: 'caykur', kg: 320, status: 'received', assignTo: 0 },
    { date: '2026-06-09', firm: 'caykur', kg: 280, status: 'received', assignTo: 0 },
    { date: '2026-06-22', firm: 'caykur', kg: 450, status: 'received', assignTo: 1 },
    { date: '2026-07-14', firm: 'ofcay', kg: 210, status: 'pending', assignTo: null },
    { date: '2026-08-03', firm: 'caykur', kg: 510, status: 'pending', assignTo: null },
    { date: '2026-08-28', firm: 'caykur', kg: 190, status: 'received', assignTo: null },
];

@Injectable()
export class SeedService implements OnModuleInit {
    private readonly logger = new Logger(SeedService.name);

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        @InjectRepository(Firm) private readonly firmRepo: Repository<Firm>,
        @InjectRepository(FirmTariff) private readonly tariffRepo: Repository<FirmTariff>,
        @InjectRepository(Field) private readonly fieldRepo: Repository<Field>,
        @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
        @InjectRepository(Harvest) private readonly harvestRepo: Repository<Harvest>,
        @InjectRepository(PaymentHarvest) private readonly paymentHarvestRepo: Repository<PaymentHarvest>,
    ) { }

    async onModuleInit(): Promise<void> {
        if (this.configService.get<string>('SEED_DEMO') !== 'true') {
            return;
        }
        try {
            const user = await this.ensureDemoUser();
            if (!user) {
                this.logger.warn('Demo seed: could not resolve a demo user, skipping');
                return;
            }
            await this.seedFirms();
            await this.seedFields(user);
            await this.seedDeliveries(user);
            this.logger.log('Demo seed complete');
        } catch (err) {
            this.logger.error(`Demo seed failed: ${(err as Error).message}`);
        }
    }

    private async ensureDemoUser(): Promise<User | null> {
        const email = (this.configService.get<string>('SEED_DEMO_EMAIL') || 'demo@cayhesabim.com').toLowerCase();
        const existing = await this.userRepo.findOne({ where: { email, deleted: false } });
        if (existing) {
            // Backfill Çaykur profile fields without touching credentials.
            const patch: Partial<User> = {};
            if (!existing.cuzdanNo) patch.cuzdanNo = '100042';
            if (existing.quotaPerDekarKg == null) patch.quotaPerDekarKg = 30;
            if (!existing.appointmentDays) patch.appointmentDays = ['wednesday', 'saturday'];
            if (Object.keys(patch).length > 0) {
                await this.userRepo.update(existing.id, patch);
                return this.userRepo.findOne({ where: { id: existing.id } });
            }
            return existing;
        }

        const password = this.configService.get<string>('SEED_DEMO_PASSWORD') || 'Caykur2026';
        const user = this.userRepo.create({
            fullName: 'Ahmet Emin Zengin',
            email,
            password: await bcrypt.hash(password, 12),
            phone: '5550000042',
            province: 'Rize',
            district: 'Çayeli',
            farmerIdNumber: '99999999042',
            cuzdanNo: '100042',
            userType: UserType.LAND_OWNER,
            role: Role.USER,
            emailVerified: true,
            verifiedAt: new Date(),
            quotaPerDekarKg: 30,
            appointmentDays: ['wednesday', 'saturday'],
        });
        const saved = await this.userRepo.save(user);
        this.logger.log(`Demo user created: ${email} (password: ${password})`);
        return saved;
    }

    private async seedFirms(): Promise<void> {
        for (const seed of FIRM_SEEDS) {
            let firm = await this.firmRepo.findOne({ where: { name: seed.name } });
            if (!firm) {
                firm = await this.firmRepo.save(
                    this.firmRepo.create({
                        name: seed.name,
                        description: seed.description,
                        isActive: true,
                        isCaykur: seed.isCaykur,
                    }),
                );
            } else if (firm.isCaykur !== seed.isCaykur) {
                await this.firmRepo.update(firm.id, { isCaykur: seed.isCaykur });
            }

            const tariffCount = await this.tariffRepo.count({ where: { firmId: firm.id } });
            if (tariffCount === 0) {
                for (const t of seed.tariffs) {
                    await this.tariffRepo.save(
                        this.tariffRepo.create({
                            firmId: firm.id,
                            paymentTerm: t.paymentTerm,
                            pricePerKg: t.pricePerKg,
                            paymentMonth: t.paymentMonth ?? null,
                            effectiveDate: new Date('2026-05-01'),
                            endDate: null,
                            isActive: true,
                        }),
                    );
                }
            }
        }
    }

    private async seedFields(user: User): Promise<void> {
        const existing = await this.fieldRepo.count({ where: { userId: user.id, deleted: false } });
        if (existing > 0) {
            return; // respect the user's real lands
        }
        for (const seed of FIELD_SEEDS) {
            await this.fieldRepo.save(
                this.fieldRepo.create({
                    userId: user.id,
                    name: seed.name,
                    province: 'Rize',
                    district: seed.district,
                    neighborhood: seed.neighborhood,
                    parcelNo: seed.parcelNo,
                    adaNo: seed.adaNo,
                    coordinates: this.squarePolygon(seed.lng, seed.lat),
                    area: seed.area,
                    areaUnit: 'm2',
                    partnerCount: 1,
                }),
            );
        }
    }

    private async seedDeliveries(user: User): Promise<void> {
        const already = await this.paymentRepo.count({ where: { userId: user.id, source: 'caykur' } });
        if (already > 0) {
            return;
        }
        const firms = await this.firmRepo.find();
        const caykur = firms.find((f) => f.isCaykur) ?? null;
        const ofcay = firms.find((f) => f.name === 'OFÇAY') ?? null;
        const fields = await this.fieldRepo.find({
            where: { userId: user.id, deleted: false },
            order: { createdAt: 'ASC' },
        });

        for (const d of DELIVERY_SEEDS) {
            const firm = d.firm === 'caykur' ? caykur : ofcay;
            const price = d.firm === 'caykur' ? CAYKUR_PRICE : OFCAY_PRICE;
            const payment = await this.paymentRepo.save(
                this.paymentRepo.create({
                    userId: user.id,
                    totalAmountKg: d.kg,
                    totalPrice: Math.round(d.kg * price * 100) / 100,
                    firmId: firm?.id ?? null,
                    tariffLabel: `Peşin Ödeme - ₺${price.toFixed(2)}/kg`,
                    source: 'caykur',
                    paymentDate: new Date(d.date),
                    paymentStatus: d.status,
                }),
            );

            const field = d.assignTo != null ? fields[d.assignTo] : null;
            if (field) {
                const harvest = await this.harvestRepo.save(
                    this.harvestRepo.create({
                        fieldId: field.id,
                        harvestDate: new Date(d.date),
                        amountKg: d.kg,
                    }),
                );
                await this.paymentHarvestRepo.save(
                    this.paymentHarvestRepo.create({
                        paymentId: payment.id,
                        harvestId: harvest.id,
                        usedAmountKg: d.kg,
                    }),
                );
            }
        }
    }

    /** Builds a tiny closed square polygon (~120m) centred on the given point. */
    private squarePolygon(lng: number, lat: number): number[][][] {
        const d = 0.0008;
        return [[
            [lng - d, lat - d],
            [lng + d, lat - d],
            [lng + d, lat + d],
            [lng - d, lat + d],
            [lng - d, lat - d],
        ]];
    }
}
