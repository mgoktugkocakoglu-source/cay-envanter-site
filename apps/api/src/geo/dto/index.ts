export interface ProvinceDto {
    id: string;
    name: string;
    bounds: number[][][];
}

export interface DistrictDto {
    id: string;
    name: string;
    bounds: number[][][];
}

export interface NeighborhoodDto {
    id: string;
    name: string;
    bounds: number[][][];
}

export interface ParcelDto {
    id: string;
    parcelNo: string;
    polygon: number[][][];
    area: number;
}

export interface ParcelDetailDto {
    polygon: number[][][];
    properties: {
        ilAd: string;
        ilceAd: string;
        mahalleAd: string;
        parselNo: string;
        adaNo: string;
        alan: string;
        nitelik: string;
        ozet: string;
        pafta: string;
        mevkii: string;
        ilId: number;
        ilceId: number;
        mahalleId: number;
    };
}
