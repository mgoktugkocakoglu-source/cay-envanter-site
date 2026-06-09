/**
 * Çaykur institutional staff roles.
 *
 * A user with a non-null caykurRole is Çaykur staff; null means a producer
 * (müstahsil). These string values are byte-identical to the frontend
 * CaykurRole union in apps/web/src/services/caykur/roles.ts — that equality is
 * the contract that lets the web app reuse its existing access matrix.
 */
export enum CaykurRole {
    KURUM_ADMIN = 'kurum_admin',
    FABRIKA_SORUMLUSU = 'fabrika_sorumlusu',
    ALIM_YERI_PERSONELI = 'alim_yeri_personeli',
    SAHA_PERSONELI = 'saha_personeli',
    DENETCI = 'denetci',
    FINANS = 'finans',
}
