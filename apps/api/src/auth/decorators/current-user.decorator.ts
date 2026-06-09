import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role, CaykurRole } from '@/auth/enums';

export interface AuthenticatedUser {
    id: string;
    email: string;
    role: Role;
    caykurRole: CaykurRole | null;
}

/**
 * Custom decorator to extract the current authenticated user from the request.
 * Usage: @CurrentUser() user: AuthenticatedUser
 * 
 * Can optionally extract a specific property:
 * @CurrentUser('id') userId: string
 * @CurrentUser('email') email: string
 */
export const CurrentUser = createParamDecorator(
    (
        data: keyof AuthenticatedUser | undefined,
        ctx: ExecutionContext,
    ): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user as AuthenticatedUser;

        if (!user) {
            return null as unknown as AuthenticatedUser;
        }

        // If a specific property is requested, return just that
        if (data) {
            return user[data];
        }

        return user;
    },
);
