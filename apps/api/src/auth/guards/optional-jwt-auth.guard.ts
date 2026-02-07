import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT Authentication Guard
 * 
 * Unlike JwtAuthGuard, this guard does NOT throw an error when authentication fails.
 * It allows requests to proceed even if no valid token is present.
 * 
 * Use this when you want to:
 * - Provide different responses for authenticated vs unauthenticated users
 * - Add optional user context to requests without enforcing authentication
 * 
 * Example: Public content that can be enriched with user-specific data if available.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    handleRequest(err: any, user: any) {
        // Return user if authenticated, otherwise return null without throwing
        return user || null;
    }

    canActivate(context: ExecutionContext) {
        // Add user to request if authenticated, but don't block the request
        return super.canActivate(context) as Promise<boolean> | boolean;
    }
}
