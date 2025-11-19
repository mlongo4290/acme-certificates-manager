import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const certManagerGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.hasRole('ADMIN') || authService.hasRole('CERT_MANAGER')) {
        return true;
    }

    router.navigate(['/auth/access']);
    return false;
};
