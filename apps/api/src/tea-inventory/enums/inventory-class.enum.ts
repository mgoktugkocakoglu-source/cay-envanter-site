/**
 * Decision-matrix classes (TKGM parcel × Çaykur license × satellite tea detection).
 * Values are byte-identical to the cay-envanter engine's InventoryClass.
 */
export enum InventoryClass {
    COMPLIANT = 'compliant',
    OVER_QUOTA = 'over_quota',
    GHOST_LICENSE = 'ghost_license',
    EXPANDED = 'expanded',
    UNLICENSED = 'unlicensed',
    PUBLIC_LAND = 'public_land',
    UNCERTAIN = 'uncertain',
    NO_TEA = 'no_tea',
}
