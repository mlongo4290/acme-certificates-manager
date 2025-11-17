import { Logger } from '../logger.service';
import { IDnsProvider } from './base-dns-provider';
import { ManualDnsProvider } from './manual-dns-provider';

/**
 * DNS Provider Factory - manages registration and creation of DNS provider implementations
 */
export class DnsProviderFactory {
    private static providers: Map<string, new () => IDnsProvider> = new Map();
    private static logger = new Logger('DnsProviderFactory');

    /**
     * Register a DNS provider implementation
     */
    static registerProvider(type: string, providerClass: new () => IDnsProvider): void {
        this.providers.set(type.toLowerCase(), providerClass);
    }

    /**
     * Get a DNS provider instance by type
     */
    static getProvider(type: string): IDnsProvider {
        const providerClass = this.providers.get(type.toLowerCase());

        if (!providerClass) {
            // Fallback to manual provider if unknown type
            this.logger.warn(`DNS provider '${type}' not found. Falling back to manual mode.`);
            return new ManualDnsProvider();
        }

        return new providerClass();
    }

    /**
     * Get list of registered provider types
     */
    static getRegisteredProviders(): string[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Check if a provider type is registered
     */
    static isProviderRegistered(type: string): boolean {
        return this.providers.has(type.toLowerCase());
    }

    /**
     * Get metadata for all registered providers
     * Returns information about available providers and their required credentials
     */
    static getProvidersMetadata(): Array<{
        type: string;
        label: string;
        requiredCredentials: string[];
        optionalCredentials: string[];
    }> {
        const metadata: Array<{
            type: string;
            label: string;
            requiredCredentials: string[];
            optionalCredentials: string[];
        }> = [];

        for (const [type, ProviderClass] of this.providers.entries()) {
            const instance = new ProviderClass();

            // Generate label from type (capitalize first letter)
            const label = type
                .split(/[-_]/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            metadata.push({
                type,
                label,
                requiredCredentials: instance.getRequiredCredentials(),
                optionalCredentials: instance.getOptionalCredentials?.() || []
            });
        }

        return metadata.sort((a, b) => {
            // Manual first, then alphabetically
            if (a.type === 'manual') return -1;
            if (b.type === 'manual') return 1;
            return a.label.localeCompare(b.label);
        });
    }

    /**
     * Get metadata for a specific provider type
     */
    static getProviderMetadata(type: string): {
        type: string;
        label: string;
        requiredCredentials: string[];
        optionalCredentials: string[];
    } | null {
        const providerClass = this.providers.get(type.toLowerCase());

        if (!providerClass) {
            return null;
        }

        const instance = new providerClass();
        const label = type
            .split(/[-_]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        return {
            type: type.toLowerCase(),
            label,
            requiredCredentials: instance.getRequiredCredentials(),
            optionalCredentials: instance.getOptionalCredentials?.() || []
        };
    }
}

// Register built-in providers
DnsProviderFactory.registerProvider('manual', ManualDnsProvider);
