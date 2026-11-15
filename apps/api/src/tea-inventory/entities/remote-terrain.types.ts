/** Relative ground surface from an existing flight; not a surveyed DEM or a licence area measurement. */
export interface RemoteTerrain {
    sourceId: string;
    capturedAt: string;
    capturedAtNote: string;
    imageUrl: string;
    bounds: { southWest: [number, number]; northEast: [number, number] };
    width: number;
    height: number;
    widthM: number;
    heightM: number;
    reliefM: number;
    note: string;
    georefRmsM: number;
    georefMaxResidualM: number;
}
