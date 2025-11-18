import * as x509 from '@peculiar/x509';
import { Logger } from '../services/logger.service';

const logger = new Logger('CertificateParser');

/**
 * Parse a PEM certificate and extract expiry date
 */
export function getCertificateExpiryDate(certificatePem: string): Date | null {
    try {
        if (!certificatePem) {
            return null;
        }

        // Parse the PEM certificate
        const cert = new x509.X509Certificate(certificatePem);

        // Return the notAfter date (expiry date)
        return new Date(cert.notAfter);
    } catch (error) {
        logger.error('Error parsing certificate:', error as Error);
        return null;
    }
}

/**
 * Parse a PEM certificate and extract all relevant information
 */
export function parseCertificate(certificatePem: string): any {
    try {
        if (!certificatePem) {
            return null;
        }

        const cert = new x509.X509Certificate(certificatePem);

        return {
            subject: cert.subject,
            issuer: cert.issuer,
            serialNumber: cert.serialNumber,
            notBefore: new Date(cert.notBefore),
            notAfter: new Date(cert.notAfter),
            subjectAlternativeNames: cert.getExtension('2.5.29.17')?.toString() || null,
        };
    } catch (error) {
        logger.error('Error parsing certificate:', error as Error);
        return null;
    }
}
