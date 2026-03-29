export enum JobListingType {
    WORKER = 'worker', // İş arayan işçi
    JOB = 'job',       // İşçi arayan işveren
}

export enum JobListingCategory {
    TEA_PICKING = 'tea-picking',
    TEA_TRANSPORT = 'tea-transport',
    DAILY_JOBS = 'daily-jobs',
}

export enum JobListingStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    FILLED = 'filled',
}
