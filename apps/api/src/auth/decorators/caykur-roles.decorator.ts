import { SetMetadata } from '@nestjs/common';
import { CaykurRole } from '@/auth/enums';

export const CAYKUR_ROLES_KEY = 'caykurRoles';

/**
 * Decorator to restrict a route to specific Çaykur staff roles.
 * Use with CaykurRolesGuard. Role.ADMIN always passes (god mode).
 *
 * @example
 * @CaykurRoles(CaykurRole.KURUM_ADMIN, CaykurRole.FABRIKA_SORUMLUSU)
 * @UseGuards(JwtAuthGuard, CaykurRolesGuard)
 * @Post('staff')
 * createStaff() { ... }
 */
export const CaykurRoles = (...roles: CaykurRole[]) =>
    SetMetadata(CAYKUR_ROLES_KEY, roles);
