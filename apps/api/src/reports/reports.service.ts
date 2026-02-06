import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentHarvest } from '@/payments/entities';
import { Harvest } from '@/harvests/entities';
import { Field } from '@/fields/entities';
import {
    YearlySummary,
    MonthlyData,
    FieldProfitability,
    YearComparison,
} from '@/reports/dto';

const MONTH_NAMES = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(
        @InjectRepository(Payment)
        private readonly paymentRepository: Repository<Payment>,
        @InjectRepository(Harvest)
        private readonly harvestRepository: Repository<Harvest>,
        @InjectRepository(Field)
        private readonly fieldRepository: Repository<Field>,
        @InjectRepository(PaymentHarvest)
        private readonly paymentHarvestRepository: Repository<PaymentHarvest>,
    ) { }

    async getYearlySummary(userId: string, year: number): Promise<YearlySummary> {
        // Get total income
        const incomeResult = await this.paymentRepository
            .createQueryBuilder('p')
            .where('p.userId = :userId', { userId })
            .andWhere('EXTRACT(YEAR FROM p.paymentDate) = :year', { year })
            .select('SUM(p.totalPrice)', 'totalIncome')
            .addSelect('SUM(p.totalAmountKg)', 'totalSoldKg')
            .addSelect('COUNT(p.id)', 'paymentCount')
            .getRawOne();

        // Get total harvest
        const harvestResult = await this.harvestRepository
            .createQueryBuilder('h')
            .leftJoin('h.field', 'f')
            .where('f.userId = :userId', { userId })
            .andWhere('h.deleted = false')
            .andWhere('f.deleted = false')
            .andWhere('EXTRACT(YEAR FROM h.harvestDate) = :year', { year })
            .select('SUM(h.amountKg)', 'totalHarvestKg')
            .addSelect('COUNT(h.id)', 'harvestCount')
            .getRawOne();

        // Get active field count
        const fieldCount = await this.fieldRepository.count({
            where: { userId, deleted: false },
        });

        const totalIncome = parseFloat(incomeResult?.totalIncome || '0');
        const totalSoldKg = parseFloat(incomeResult?.totalSoldKg || '0');
        const totalHarvestKg = parseFloat(harvestResult?.totalHarvestKg || '0');

        return {
            year,
            totalIncome,
            totalHarvestKg,
            averagePricePerKg: totalSoldKg > 0 ? totalIncome / totalSoldKg : 0,
            activeFieldCount: fieldCount,
            harvestCount: parseInt(harvestResult?.harvestCount || '0', 10),
            paymentCount: parseInt(incomeResult?.paymentCount || '0', 10),
        };
    }

    async getMonthlyIncome(userId: string, year: number): Promise<MonthlyData[]> {
        const result = await this.paymentRepository
            .createQueryBuilder('p')
            .where('p.userId = :userId', { userId })
            .andWhere('EXTRACT(YEAR FROM p.paymentDate) = :year', { year })
            .select('EXTRACT(MONTH FROM p.paymentDate)', 'month')
            .addSelect('SUM(p.totalPrice)', 'income')
            .addSelect('SUM(p.totalAmountKg)', 'harvestKg')
            .addSelect('COUNT(p.id)', 'count')
            .groupBy('EXTRACT(MONTH FROM p.paymentDate)')
            .orderBy('month', 'ASC')
            .getRawMany();

        // Fill in all months
        const monthlyData: MonthlyData[] = [];
        for (let month = 1; month <= 12; month++) {
            const found = result.find((r) => parseInt(r.month, 10) === month);
            monthlyData.push({
                month,
                monthName: MONTH_NAMES[month - 1],
                income: parseFloat(found?.income || '0'),
                harvestKg: parseFloat(found?.harvestKg || '0'),
                harvestCount: parseInt(found?.count || '0', 10),
            });
        }

        return monthlyData;
    }

    async getMonthlyHarvest(userId: string, year: number): Promise<MonthlyData[]> {
        const result = await this.harvestRepository
            .createQueryBuilder('h')
            .leftJoin('h.field', 'f')
            .where('f.userId = :userId', { userId })
            .andWhere('h.deleted = false')
            .andWhere('f.deleted = false')
            .andWhere('EXTRACT(YEAR FROM h.harvestDate) = :year', { year })
            .select('EXTRACT(MONTH FROM h.harvestDate)', 'month')
            .addSelect('SUM(h.amountKg)', 'harvestKg')
            .addSelect('COUNT(h.id)', 'count')
            .groupBy('EXTRACT(MONTH FROM h.harvestDate)')
            .orderBy('month', 'ASC')
            .getRawMany();

        const monthlyData: MonthlyData[] = [];
        for (let month = 1; month <= 12; month++) {
            const found = result.find((r) => parseInt(r.month, 10) === month);
            monthlyData.push({
                month,
                monthName: MONTH_NAMES[month - 1],
                income: 0,
                harvestKg: parseFloat(found?.harvestKg || '0'),
                harvestCount: parseInt(found?.count || '0', 10),
            });
        }

        return monthlyData;
    }

    async getFieldProfitability(userId: string, year?: number): Promise<FieldProfitability[]> {
        let qb = this.fieldRepository
            .createQueryBuilder('f')
            .leftJoin('harvests', 'h', 'h.field_id = f.id AND h.deleted = false')
            .leftJoin('payment_harvests', 'ph', 'ph.harvest_id = h.id')
            .leftJoin('payments', 'p', 'p.id = ph.payment_id')
            .where('f.userId = :userId', { userId })
            .andWhere('f.deleted = false')
            .select('f.id', 'fieldId')
            .addSelect('f.name', 'fieldName')
            .addSelect('f.area', 'area')
            .addSelect('f.areaUnit', 'areaUnit')
            .addSelect('COALESCE(SUM(h.amountKg), 0)', 'totalHarvestKg')
            .addSelect('COALESCE(SUM(ph.usedAmountKg * p.totalPrice / p.totalAmountKg), 0)', 'totalIncome')
            .groupBy('f.id');

        if (year) {
            qb = qb.andWhere('EXTRACT(YEAR FROM h.harvestDate) = :year', { year });
        }

        const results = await qb.getRawMany();

        // Calculate metrics and sort
        const profitability: FieldProfitability[] = results.map((r) => {
            const area = parseFloat(r.area);
            const totalHarvestKg = parseFloat(r.totalHarvestKg);
            const totalIncome = parseFloat(r.totalIncome);
            const harvestPerArea = area > 0 ? totalHarvestKg / area : 0;
            const incomePerArea = area > 0 ? totalIncome / area : 0;

            // Simple performance score (1-5 stars based on income per area percentile)
            // This will be calculated after sorting
            return {
                fieldId: r.fieldId,
                fieldName: r.fieldName,
                area,
                areaUnit: r.areaUnit,
                totalHarvestKg,
                totalIncome,
                harvestPerArea,
                incomePerArea,
                performanceScore: 0,
            };
        });

        // Sort by income per area
        profitability.sort((a, b) => b.incomePerArea - a.incomePerArea);

        // Assign performance scores (1-5 based on position)
        const total = profitability.length;
        profitability.forEach((field, index) => {
            if (total <= 5) {
                field.performanceScore = 5 - index;
            } else {
                const percentile = (total - index) / total;
                field.performanceScore = Math.ceil(percentile * 5);
            }
            // Ensure minimum of 1 if there's any data
            if (field.totalIncome > 0 && field.performanceScore < 1) {
                field.performanceScore = 1;
            }
        });

        return profitability;
    }

    async getYearComparison(userId: string, years: number[]): Promise<YearComparison[]> {
        const comparisons: YearComparison[] = [];

        for (let i = 0; i < years.length; i++) {
            const year = years[i];
            const summary = await this.getYearlySummary(userId, year);

            const comparison: YearComparison = {
                year,
                totalHarvestKg: summary.totalHarvestKg,
                totalIncome: summary.totalIncome,
                averagePricePerKg: summary.averagePricePerKg,
                changeFromPrevious: {
                    harvestChange: null,
                    incomeChange: null,
                    priceChange: null,
                },
            };

            // Calculate change from previous year in array
            if (i > 0) {
                const prev = comparisons[i - 1];
                if (prev.totalHarvestKg > 0) {
                    comparison.changeFromPrevious.harvestChange =
                        ((summary.totalHarvestKg - prev.totalHarvestKg) / prev.totalHarvestKg) * 100;
                }
                if (prev.totalIncome > 0) {
                    comparison.changeFromPrevious.incomeChange =
                        ((summary.totalIncome - prev.totalIncome) / prev.totalIncome) * 100;
                }
                if (prev.averagePricePerKg > 0) {
                    comparison.changeFromPrevious.priceChange =
                        ((summary.averagePricePerKg - prev.averagePricePerKg) / prev.averagePricePerKg) * 100;
                }
            }

            comparisons.push(comparison);
        }

        return comparisons;
    }
}
