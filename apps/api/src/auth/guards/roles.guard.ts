import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@/auth/enums';
import { ROLES_KEY } from '@/auth/decorators/roles.decorator';

/**
 * Guard that checks if the current user has the required roles.
 * Must be used after JwtAuthGuard to ensure req.user is populated.
 *
 * @example
 * @Roles(Role.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('admin-only')
 * adminOnlyRoute() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        // If no roles are required, allow access
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        // If no user or no role, deny access
        if (!user || !user.role) {
            return false;
        }

        // Check if user has any of the required roles
        return requiredRoles.includes(user.role);
    }
}
