/**
 * Base interface for DNS provider implementations
 */
export interface IDnsProvider {
    /**
     * Provider type identifier (e.g., 'cloudflare', 'route53', 'manual')
     */
    readonly type: string;

    /**
     * Create a DNS TXT record for ACME challenge
     * @param domain The domain for which to create the record
     * @param recordName The full DNS record name (e.g., '_acme-challenge.example.com')
     * @param value The TXT record value
     * @param credentials Provider-specific credentials
     */
    createTxtRecord(
        domain: string,
        recordName: string,
        value: string,
        credentials: Record<string, string>
    ): Promise<void>;

    /**
     * Delete a DNS TXT record after ACME challenge validation
     * @param domain The domain
     * @param recordName The full DNS record name
     * @param credentials Provider-specific credentials
     */
    deleteTxtRecord(
        domain: string,
        recordName: string,
        credentials: Record<string, string>
    ): Promise<void>;

    /**
     * Verify that a DNS TXT record exists and has propagated
     * @param domain The domain
     * @param recordName The full DNS record name
     * @param expectedValue The expected TXT record value
     * @param credentials Provider-specific credentials
     * @returns true if record exists with expected value, false otherwise
     */
    verifyTxtRecord(
        domain: string,
        recordName: string,
        expectedValue: string,
        credentials: Record<string, string>
    ): Promise<boolean>;

    /**
     * Validate that credentials are correct and have necessary permissions
     * @param credentials Provider-specific credentials
     * @returns valid: boolean, messageKey: translation key for the result message
     */
    validateCredentials(credentials: Record<string, string>): Promise<{ valid: boolean; messageKey: string }>;

    /**
     * Get required credential field names for this provider
     */
    getRequiredCredentials(): string[];

    /**
     * Get optional credential field names for this provider
     * Optional method - if not implemented, returns empty array
     */
    getOptionalCredentials?(): string[];
}

/**
 * Abstract base class for DNS providers
 */
export abstract class BaseDnsProvider implements IDnsProvider {
    abstract readonly type: string;

    abstract createTxtRecord(
        domain: string,
        recordName: string,
        value: string,
        credentials: Record<string, string>
    ): Promise<void>;

    abstract deleteTxtRecord(
        domain: string,
        recordName: string,
        credentials: Record<string, string>
    ): Promise<void>;

    /**
     * Verify that a DNS TXT record exists and has propagated
     * Default implementation uses Node.js DNS resolver
     * Providers can override this to use their API for verification
     */
    async verifyTxtRecord(
        domain: string,
        recordName: string,
        expectedValue: string,
        credentials: Record<string, string>
    ): Promise<boolean> {
        try {
            const dns = require('dns').promises;
            const txtRecords = await dns.resolveTxt(recordName);
            const flatRecords = txtRecords.flat();
            return flatRecords.includes(expectedValue);
        } catch (error) {
            return false;
        }
    }

    abstract validateCredentials(credentials: Record<string, string>): Promise<{ valid: boolean; messageKey: string }>;

    abstract getRequiredCredentials(): string[];

    /**
     * Helper to validate required credentials are present
     */
    protected validateRequiredCredentials(credentials: Record<string, string>, required: string[]): void {
        const missing = required.filter(key => !credentials[key]);
        if (missing.length > 0) {
            throw new Error(`Missing required credentials: ${missing.join(', ')}`);
        }
    }
}
