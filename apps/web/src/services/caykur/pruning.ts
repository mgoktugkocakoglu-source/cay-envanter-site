/**
 * Pruning measurement vocabulary shared by the Kurum panel's pruning audit
 * pages and the field measurement component. The measurement records
 * themselves come from the API (`api.getPruningMeasurementsPanel`).
 */

export type MeasurementMethod = 'map' | 'gps' | 'assisted' | 'imu';
export type AccuracyLevel = 'high' | 'medium' | 'low';
