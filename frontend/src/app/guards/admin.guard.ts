import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated() && authService.hasRole('ADMIN')) {
        return true;
    }

    // Redirect to access denied page
    router.navigate(['/auth/access']);
    return false;
};
