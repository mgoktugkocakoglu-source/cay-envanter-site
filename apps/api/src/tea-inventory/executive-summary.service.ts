import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeaInventoryArea } from '@/tea-inventory/entities/tea-inventory-area.entity';
import type { AuditDecision } from '@/tea-inventory/entities/licence-audit.types';
import type { CheckStatus, ComplianceOverall, ComplianceRule } from '@/tea-inventory/entities/compliance.types';
import type { DroneClass } from '@/tea-inventory/entities/drone-verification.types';

/** One neighbourhood on the executive summary: what has been checked there, by which evidence, and what is open. */
export interface ExecutiveAreaRow {
    id: string;
    code: string;
    province: string;
    district: string;
    neighborhood: string;
    updatedAt: string;
    licenceSource: 'demo' | 'caykur' | null;
    /** Parcels the licence audit covers (0 until it has run). */
    parcels: number;
    audit: { generatedAt: string; byDecision: Record<AuditDecision, number> } | null;
    compliance: { generatedAt: string; rulesetVersion: string; byOverall: Record<ComplianceOverall, number> } | null;
    drone: { analysedAt: string | null; analysed: number; needsReview: number; verified: number; byClass: Partial<Record<DroneClass, number>>; rmsM: number | null } | null;
    /** Parcels a person has observed on the ground. */
    fieldObserved: number;
}
export interface ExecutiveSummary {
    generatedAt: string;
    totals: {
        areas: number;
        areasAudited: number;
        areasWithCompliance: number;
        areasWithDrone: number;
        demoAreas: number;
        parcels: number;
        byOverall: Record<ComplianceOverall, number>;
        droneAnalysed: number;
        droneVerified: number;
        fieldObserved: number;
    };
    /** Open checks per rule over every neighbourhood with a compliance report, most open first. */
    openRules: Array<{ id: string; title: string; fail: number; review: number }>;
    areas: ExecutiveAreaRow[];
}

interface Row {
    id: string;
    code: string;
    province: string;
    district: string;
    neighborhood: string;
    updated_at: Date;
    audit_summary: { parcels: number; byDecision: Record<AuditDecision, number> } | null;
    audit_generated_at: string | null;
    licence_source: 'demo' | 'caykur' | null;
    field_observed: string | null;
    compliance_summary: { byOverall: Record<ComplianceOverall, number>; byRule: Record<string, Record<CheckStatus, number>> } | null;
    compliance_generated_at: string | null;
    ruleset_version: string | null;
    rules: ComplianceRule[] | null;
    drone_classes: Partial<Record<DroneClass, number>> | null;
    drone_needs_review: string | null;
    drone_verified: string | null;
    drone_analysed_at: string | null;
    drone_rms: string | null;
    has_drone: boolean;
}

/**
 * Executive summary over every imported neighbourhood. The module blocks are megabytes of JSON per area, so only their
 * summary parts are read, inside the database.
 */
@Injectable()
export class ExecutiveSummaryService {
    constructor(@InjectRepository(TeaInventoryArea) private readonly areaRepo: Repository<TeaInventoryArea>) { }

    async summary(): Promise<ExecutiveSummary> {
        const rows: Row[] = await this.areaRepo.query(`
            SELECT a.id, a.code, a.province, a.district, a.neighborhood, a."updatedAt" AS updated_at,
                a.licence_audit->'summary' AS audit_summary,
                a.licence_audit->>'generatedAt' AS audit_generated_at,
                a.licence_audit->>'licenceSource' AS licence_source,
                (SELECT count(*) FROM jsonb_array_elements(a.licence_audit->'parcels') p WHERE jsonb_typeof(p->'confirmation') = 'object') AS field_observed,
                a.compliance->'summary' AS compliance_summary,
                a.compliance->>'generatedAt' AS compliance_generated_at,
                a.compliance->'ruleset'->>'version' AS ruleset_version,
                a.compliance->'ruleset'->'rules' AS rules,
                a.drone_verification IS NOT NULL AS has_drone,
                (SELECT jsonb_object_agg(x.c, x.n) FROM (SELECT p->>'class' AS c, count(*) AS n FROM jsonb_array_elements(a.drone_verification->'parcels') p GROUP BY 1) x) AS drone_classes,
                (SELECT count(*) FROM jsonb_array_elements(a.drone_verification->'parcels') p WHERE p->>'status' = 'needs_review') AS drone_needs_review,
                (SELECT count(*) FROM jsonb_array_elements(a.drone_verification->'parcels') p WHERE p->'review'->>'verified' = 'true') AS drone_verified,
                (SELECT max(p->>'analysedAt') FROM jsonb_array_elements(a.drone_verification->'parcels') p) AS drone_analysed_at,
                a.drone_verification->'georeference'->>'rmsM' AS drone_rms
            FROM tea_inventory_areas a
            ORDER BY a.province, a.district, a.neighborhood
        `);
        const areas = rows.map((r) => this.toArea(r));
        const byOverall: Record<ComplianceOverall, number> = { finding: 0, review: 0, no_evidence: 0, conforming: 0, out_of_scope: 0 };
        const open = new Map<string, { id: string; title: string; fail: number; review: number }>();
        for (const r of rows) {
            if (!r.compliance_summary) continue;
            for (const key of Object.keys(byOverall) as ComplianceOverall[]) byOverall[key] += r.compliance_summary.byOverall[key] ?? 0;
            for (const rule of r.rules ?? []) {
                const counts = r.compliance_summary.byRule[rule.id];
                const entry = open.get(rule.id) ?? { id: rule.id, title: rule.title, fail: 0, review: 0 };
                entry.fail += counts?.fail ?? 0;
                entry.review += counts?.review ?? 0;
                open.set(rule.id, entry);
            }
        }
        const sum = (pick: (a: ExecutiveAreaRow) => number) => areas.reduce((total, a) => total + pick(a), 0);
        return {
            generatedAt: new Date().toISOString(),
            totals: {
                areas: areas.length,
                areasAudited: areas.filter((a) => a.audit).length,
                areasWithCompliance: areas.filter((a) => a.compliance).length,
                areasWithDrone: areas.filter((a) => a.drone).length,
                demoAreas: areas.filter((a) => a.licenceSource === 'demo').length,
                parcels: sum((a) => a.parcels),
                byOverall,
                droneAnalysed: sum((a) => a.drone?.analysed ?? 0),
                droneVerified: sum((a) => a.drone?.verified ?? 0),
                fieldObserved: sum((a) => a.fieldObserved),
            },
            openRules: [...open.values()].filter((r) => r.fail + r.review > 0).sort((a, b) => b.fail - a.fail || b.review - a.review),
            areas,
        };
    }

    private toArea(r: Row): ExecutiveAreaRow {
        const classes = r.drone_classes ?? {};
        return {
            id: r.id,
            code: r.code,
            province: r.province,
            district: r.district,
            neighborhood: r.neighborhood,
            updatedAt: new Date(r.updated_at).toISOString(),
            licenceSource: r.licence_source,
            parcels: r.audit_summary?.parcels ?? 0,
            audit: r.audit_summary && r.audit_generated_at ? { generatedAt: r.audit_generated_at, byDecision: r.audit_summary.byDecision } : null,
            compliance: r.compliance_summary && r.compliance_generated_at ? { generatedAt: r.compliance_generated_at, rulesetVersion: r.ruleset_version ?? '', byOverall: r.compliance_summary.byOverall } : null,
            drone: r.has_drone
                ? {
                      analysedAt: r.drone_analysed_at,
                      analysed: Object.values(classes).reduce((total, n) => total + Number(n), 0),
                      needsReview: Number(r.drone_needs_review ?? 0),
                      verified: Number(r.drone_verified ?? 0),
                      byClass: classes,
                      rmsM: r.drone_rms === null ? null : Number(r.drone_rms),
                  }
                : null,
            fieldObserved: Number(r.field_observed ?? 0),
        };
    }
}
