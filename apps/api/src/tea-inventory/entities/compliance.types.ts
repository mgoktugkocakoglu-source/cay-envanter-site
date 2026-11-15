/**
 * Rule-based licence compliance report (engine: check-compliance). Every parcel is tested against a written rule set;
 * each rule carries its outcome and the evidence it was answered from. Preliminary assessment, never a decision.
 */
export const COMPLIANCE_OVERALL = ['finding', 'review', 'no_evidence', 'conforming', 'out_of_scope'] as const;
export type ComplianceOverall = (typeof COMPLIANCE_OVERALL)[number];
export type CheckStatus = 'pass' | 'fail' | 'review' | 'unknown' | 'na';
export type RuleSource = 'record' | 'satellite' | 'drone' | 'field' | 'buildings';

export interface ComplianceRule {
    id: string;
    title: string;
    expects: string;
    appliesTo: string;
    sources: RuleSource[];
    /** Whether a failed rule can stand as a finding, and on what evidence. */
    findingNeeds: string;
}
export interface ComplianceCheck {
    rule: string;
    status: CheckStatus;
    evidence: string;
}
export interface ComplianceParcel {
    key: string;
    block: string;
    parcel: string;
    nature: string;
    locality: string;
    areaM2: number;
    licensed: boolean;
    overall: ComplianceOverall;
    /** Rules that failed or went to review, worst first. */
    open: string[];
    checks: ComplianceCheck[];
    action: string;
}
export interface ComplianceBlock {
    generatedAt: string;
    method: string;
    ruleset: { id: string; version: string; status: 'draft'; note: string; config: Record<string, number>; rules: ComplianceRule[] };
    licenceSource: 'demo' | 'caykur';
    sources: { auditGeneratedAt: string; droneGeneratedAt: string | null; droneParcels: number };
    summary: { parcels: number; byOverall: Record<ComplianceOverall, number>; byRule: Record<string, Record<CheckStatus, number>> };
    parcels: ComplianceParcel[];
}
