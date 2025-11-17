import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const certManagerGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.hasRole('ADMIN') || authService.hasRole('certManager')) {
        return true;
    }

    router.navigate(['/auth/access']);
    return false;
};
