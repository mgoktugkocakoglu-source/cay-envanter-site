/*
 * Measures the NDVI screening thresholds (src/tea-inventory/ndvi-analysis.model.ts) on the imported monthly series,
 * with the code the service runs (dist build). No field labels exist, so two indirect tests are used:
 *   - mirror: every year's months are flipped around their own baseline (rises become drops). Tea does not "un-decline",
 *     so a "decline" on the mirrored series is noise: an upper bound of the false alarms;
 *   - injection: a lasting drop of known depth and start month is added to quiet parcel-years; "caught" = decline.
 * Offline: reads the seed bundle only. Run after `npx nest build`:
 *
 *   node scripts/ndvi-threshold-check.mjs [--code trabzon-of-cataldere] [--json out.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const { NDVI_RULES, monthlyEvidence, classifyNdvi } = createRequire(import.meta.url)(join(here, '..', 'dist', 'tea-inventory', 'ndvi-analysis.model.js'));
const { values } = parseArgs({ options: { code: { type: 'string', default: 'trabzon-of-cataldere' }, json: { type: 'string' } } });
const bundle = JSON.parse(readFileSync(join(here, '..', 'src', 'tea-inventory', 'seed-data', `${values.code}.json`), 'utf8'));
const pixels = new Map(bundle.licenceAudit.parcels.map((p) => [p.key, p.detection.fullPixels]));
const parcels = bundle.age.parcels.filter((p) => p.s2).map((p) => ({ key: p.key, series: p.s2, fullPixels: pixels.get(p.key) ?? 0 }));
const years = [...new Set(parcels.flatMap((p) => p.series.years))].sort((a, b) => a - b);

/** The same series with one year replaced. */
const withYear = (series, year, row) => ({ ...series, ndvi: { ...series.ndvi, [year]: row } });
const statusOf = (series, year, fullPixels, rules) => classifyNdvi(monthlyEvidence(series, year, rules), fullPixels, rules);

function measure(rules) {
    const real = { stable: 0, decline: 0, recovery: 0, review: 0, insufficient: 0 };
    const mirror = { ...real };
    const quiet = [];
    for (const p of parcels) {
        for (const year of years) {
            const months = monthlyEvidence(p.series, year, rules);
            const status = classifyNdvi(months, p.fullPixels, rules);
            real[status]++;
            if (status === 'insufficient') continue;
            // Flip around the baseline month by month; months without a baseline stay as they are.
            const flipped = months.map((m) => (m.value !== null && m.baseline !== null ? Math.max(-1, Math.min(1, 2 * m.baseline - m.value)) : m.value));
            mirror[statusOf(withYear(p.series, year, flipped), year, p.fullPixels, rules)]++;
            if (status === 'stable') quiet.push({ p, year, months });
        }
    }
    const assessed = real.stable + real.decline + real.recovery + real.review;
    const detection = {};
    for (const depth of [0.1, 0.15, 0.2, 0.3]) {
        for (const start of [1, 3]) {
            let hit = 0;
            let flagged = 0;
            for (const { p, year, months } of quiet) {
                const row = months.map((m, i) => (m.value !== null && i >= start ? m.value - depth : m.value));
                const s = statusOf(withYear(p.series, year, row), year, p.fullPixels, rules);
                if (s === 'decline') hit++;
                if (s !== 'stable') flagged++;
            }
            detection[`${depth.toFixed(2)} from month index ${start}`] = { trials: quiet.length, decline: hit, flagged };
        }
    }
    return { rules: { drop: rules.drop, minPixels: rules.minPixels }, assessed, real, mirror, mirrorDeclineShare: assessed ? mirror.decline / assessed : null, realDeclineShare: assessed ? real.decline / assessed : null, detection };
}

const pct = (x) => (x === null ? '—' : `${(x * 100).toFixed(1)} %`);
const rows = [0.08, 0.1, 0.12, 0.15, 0.2].map((drop) => measure({ ...NDVI_RULES, drop }));
console.log(`${values.code}: ${parcels.length} parcels with a monthly series, years ${years[0]}–${years.at(-1)}, months ${parcels[0]?.series.months.join(',')}`);
console.log('drop   assessed  real decline   mirror decline  mirror review   caught: 0.10 / 0.15 / 0.20 / 0.30 (lasting drop from the 2nd month; decline, in brackets any flag)');
for (const r of rows) {
    const d = (k) => { const x = r.detection[`${k} from month index 1`]; return `${pct(x.decline / x.trials)} (${pct(x.flagged / x.trials)})`; };
    console.log(`${r.rules.drop.toFixed(2)}   ${String(r.assessed).padStart(6)}   ${String(r.real.decline).padStart(4)} ${pct(r.realDeclineShare).padStart(7)}   ${String(r.mirror.decline).padStart(4)} ${pct(r.mirrorDeclineShare).padStart(7)}   ${String(r.mirror.review).padStart(5)}        ${d('0.10')} / ${d('0.15')} / ${d('0.20')} / ${d('0.30')}`);
}
console.log(`current rule: drop ${NDVI_RULES.drop}, minPixels ${NDVI_RULES.minPixels}`);
if (values.json) writeFileSync(values.json, JSON.stringify({ code: values.code, generatedAt: new Date().toISOString(), parcels: parcels.length, years, rows }, null, 1));
