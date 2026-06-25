import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, CaykurRole } from '@/auth/enums';
import { CAYKUR_ROLES_KEY } from '@/auth/decorators/caykur-roles.decorator';

/**
 * Guard that checks the current user's Çaykur staff role.
 * Must be used after JwtAuthGuard so req.user (with caykurRole) is populated.
 *
 * Platform admins (Role.ADMIN) always pass — admin is god mode and orthogonal
 * to caykurRole.
 *
 * @example
 * @CaykurRoles(CaykurRole.KURUM_ADMIN)
 * @UseGuards(JwtAuthGuard, CaykurRolesGuard)
 * @Post('staff')
 * createStaff() { ... }
 */
@Injectable()
export class CaykurRolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<CaykurRole[]>(
            CAYKUR_ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        // If no Çaykur roles are required, allow access.
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        if (!user) {
            return false;
        }

        // Platform admin sees everything.
        if (user.role === Role.ADMIN) {
            return true;
        }

        return !!user.caykurRole && requiredRoles.includes(user.caykurRole);
    }
}
