import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LoginRequest {
    username: string;
    password: string;
    provider?: string;
    deviceId?: string;
}

export interface LoginResponse {
    token?: string;
    requiresMfa?: boolean;
    tempUserId?: string;
    username?: string;
    deviceId?: string;
    user?: {
        id: string;
        username: string;
        authProvider: 'local' | 'ldap' | 'oauth2' | 'azure-ad' | 'oidc' | 'saml';
        authProviderName?: string;
        role: 'ADMIN' | 'certManager';
    };
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private readonly API_URL = environment.apiUrl;
    private readonly TOKEN_KEY = 'auth_token';

    isAuthenticated = signal<boolean>(this.isTokenValid());
    currentUser = signal<{ id: string; username: string; authProvider: 'local' | 'ldap' | 'oauth2' | 'azure-ad' | 'oidc' | 'saml'; authProviderName?: string; role: 'ADMIN' | 'certManager' } | null>(null);

    constructor(private http: HttpClient, private router: Router) {
        // Check if user is already authenticated on init
        if (this.isTokenValid()) {
            this.loadUserFromToken();
        } else if (this.getToken()) {
            // Token exists but is expired - clean up
            this.removeToken();
        }
    }

    login(credentials: LoginRequest): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.API_URL}/auth/login`, credentials).pipe(
            tap(response => {
                // Only set token and user if MFA is not required
                if (!response.requiresMfa && response.token && response.user) {
                    this.setToken(response.token);
                    this.currentUser.set(response.user);
                    this.isAuthenticated.set(true);
                }
            })
        );
    }

    verifyMfaToken(tempUserId: string, token: string, trustDevice: boolean = false, deviceId?: string): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.API_URL}/auth/verify-mfa`, {
            tempUserId,
            token,
            trustDevice,
            deviceId
        }).pipe(
            tap(response => {
                if (response.token && response.user) {
                    this.setToken(response.token);
                    this.currentUser.set(response.user);
                    this.isAuthenticated.set(true);
                }
            })
        );
    }

    logout(): void {
        this.removeToken();
        this.currentUser.set(null);
        this.isAuthenticated.set(false);
        this.router.navigateByUrl('/auth/login', { replaceUrl: true });
    }

    getToken(): string | null {
        return sessionStorage.getItem(this.TOKEN_KEY);
    }

    private setToken(token: string): void {
        sessionStorage.setItem(this.TOKEN_KEY, token);
    }

    private removeToken(): void {
        sessionStorage.removeItem(this.TOKEN_KEY);
    }

    private isTokenValid(): boolean {
        const token = this.getToken();
        if (!token) {
            return false;
        }

        try {
            // Decode JWT payload to check expiration
            const payload = JSON.parse(atob(token.split('.')[1]));

            // Check if token has exp claim and if it's not expired
            if (payload.exp) {
                const now = Math.floor(Date.now() / 1000); // Current time in seconds
                return payload.exp > now;
            }

            // If no exp claim, consider token valid (shouldn't happen in production)
            return true;
        } catch (error) {
            // If token is malformed, consider it invalid
            return false;
        }
    }

    hasRole(role: 'ADMIN' | 'certManager'): boolean {
        return this.currentUser()?.role === role;
    }

    private loadUserFromToken(): void {
        // Decode JWT to get user info and validate expiration
        const token = this.getToken();
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));

                // Check token expiration
                if (payload.exp) {
                    const now = Math.floor(Date.now() / 1000);
                    if (payload.exp <= now) {
                        // Token expired - logout and redirect
                        this.logout();
                        return;
                    }
                }

                this.currentUser.set({
                    id: payload.userId,
                    username: payload.username,
                    authProvider: payload.authProvider,
                    authProviderName: payload.authProviderName,
                    role: payload.role
                });
            } catch (error) {
                this.logout();
            }
        }
    }
}
