import { CommonModule, formatDate } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { X509Certificate } from '@peculiar/x509';
import { BadgeModule } from 'primeng/badge';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TabsModule } from 'primeng/tabs';
import { firstValueFrom } from 'rxjs';

interface CertificateExtensionData {
    label: string;
    value: string;
    class?: string;
}

interface CertificateExtension {
    name: string;
    critical: boolean;
    value: CertificateExtensionData[];
}

interface CertificateInfo {
    index: number;
    commonName: string;
    organization?: string;
    organizationalUnit?: string;
    country?: string;
    state?: string;
    locality?: string;
    issuerCommonName: string;
    issuerOrganization?: string;
    issuerCountry?: string;
    issuerIndex?: number; // Index of the issuer certificate in the chain
    serialNumber: string;
    notBefore: Date;
    notAfter: Date;
    subjectAltNames: { type: string; value: string }[];
    publicKeyAlgorithm: string;
    publicKeySize?: number;
    publicKeyExponent?: string;
    publicKeyModulus?: string;
    signatureAlgorithm: string;
    version: number;
    fingerprints: {
        sha256: string;
        sha1: string;
    };
    extensions: CertificateExtension[];
    rawCert: string;
}

@Component({
    selector: 'app-certificate-viewer',
    standalone: true,
    imports: [CommonModule, TranslateModule, TabsModule, BadgeModule, DividerModule, CardModule],
    templateUrl: './certificate-viewer.component.html',
    styleUrl: '../../../assets/certificate-viewer.scss'
})
export class CertificateViewerComponent implements OnInit, OnChanges {
    public translateService = inject(TranslateService);
    private http = inject(HttpClient);

    @Input() certificatePem: string = '';

    certificates: CertificateInfo[] = [];
    activeTabIndex = 0;

    ngOnInit() {
        this.parseCertificateChain();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['certificatePem'] && !changes['certificatePem'].firstChange) {
            this.certificates = [];
            this.activeTabIndex = 0;
            this.parseCertificateChain();
        }
    }

    onTabChange(event: any) {
        this.activeTabIndex = event.index;
    }

    private async parseCertificateChain() {
        if (!this.certificatePem) return;

        // Split PEM chain into individual certificates
        const certRegex = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;
        const certMatches = this.certificatePem.match(certRegex);

        if (!certMatches) return;

        this.certificates = await Promise.all(
            certMatches.map((certPem, index) => this.parseCertificate(certPem, index))
        );

        // Link issuers to their certificate index in the chain
        this.linkIssuersToCertificates();

        // Try to download missing CA certificates
        await this.downloadMissingCACertificates();
    }

    private linkIssuersToCertificates() {
        for (let i = 0; i < this.certificates.length; i++) {
            const cert = this.certificates[i];

            // Find the issuer certificate in the chain
            // Try matching by commonName or organization
            const issuerIndex = this.certificates.findIndex(c => {
                const matchByCommonName = c.commonName === cert.issuerCommonName && c.index !== cert.index;
                const matchByOrg = !c.commonName && c.organization === cert.issuerCommonName && c.index !== cert.index;
                return matchByCommonName || matchByOrg;
            });

            if (issuerIndex >= 0) {
                cert.issuerIndex = issuerIndex;
            }
        }
    }

    private async downloadMissingCACertificates() {
        // Find certificates with missing issuers
        const certsWithMissingIssuers = this.certificates.filter(cert => cert.issuerIndex === undefined);

        for (const cert of certsWithMissingIssuers) {
            // Look for AIA extension with CA Issuers URL
            const aiaExt = cert.extensions?.find(ext => ext.name === this.translateService.instant('certificates.viewer.authorityInfoAccess'));
            if (!aiaExt) continue;

            // Extract CA Issuers URL - look for URLs after "CA Issuers:" or any http URL that's not OCSP
            const aiaValue = aiaExt.value[0].value;
            const lines = aiaValue.split('\n');
            let caUrl: string | null = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('CA Issuers:')) {
                    // Next line should contain the URL
                    if (i + 1 < lines.length) {
                        caUrl = lines[i + 1].trim();
                        break;
                    }
                } else if (line.match(/^https?:\/\//) && !line.toLowerCase().includes('ocsp')) {
                    // Direct URL that's not OCSP
                    caUrl = line;
                    break;
                }
            }

            if (!caUrl) {
                continue;
            }

            try {
                // Use backend proxy to download the certificate
                const proxyUrl = `/api/certificates/proxy-ca-cert?url=${encodeURIComponent(caUrl)}`;
                const derData = await firstValueFrom(
                    this.http.get(proxyUrl, { responseType: 'arraybuffer' })
                );

                // Convert DER to PEM
                const base64Der = btoa(String.fromCharCode(...new Uint8Array(derData)));
                const pemCert = `-----BEGIN CERTIFICATE-----\n${base64Der.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`;

                // Parse and add to chain
                const newCert = await this.parseCertificate(pemCert, this.certificates.length);
                this.certificates.push(newCert);

                // Re-link issuers
                this.linkIssuersToCertificates();
            } catch (error) {
            }
        }
    }

    private async parseCertificate(pem: string, index: number): Promise<CertificateInfo> {
        try {
            const cert = new X509Certificate(pem);

            // Parse subject
            const subject = this.parseDistinguishedName(cert.subject);
            const issuer = this.parseDistinguishedName(cert.issuer);

            // Parse SAN
            const sanExtension = cert.getExtension('2.5.29.17');
            const subjectAltNames = this.parseSubjectAltNames(sanExtension);

            // Get public key details (size, exponent and modulus for RSA)
            const publicKeyDetails = await this.getPublicKeyDetails(cert);

            // Calculate fingerprints
            const fingerprints = await this.calculateFingerprints(cert.rawData);

            // Parse extensions
            const extensions = this.parseExtensions(cert);

            return {
                index,
                commonName: subject['CN'] || subject['O'] || this.translateService.instant('unknown'),
                organization: subject['O'],
                organizationalUnit: subject['OU'],
                country: subject['C'],
                state: subject['ST'],
                locality: subject['L'],
                issuerCommonName: issuer['CN'] || issuer['O'] || this.translateService.instant('unknown'),
                issuerOrganization: issuer['O'],
                issuerCountry: issuer['C'],
                serialNumber: cert.serialNumber,
                notBefore: cert.notBefore,
                notAfter: cert.notAfter,
                subjectAltNames,
                publicKeyAlgorithm: cert.publicKey.algorithm.name,
                publicKeySize: publicKeyDetails.size,
                publicKeyExponent: publicKeyDetails.exponent,
                publicKeyModulus: publicKeyDetails.modulus,
                signatureAlgorithm: cert.signatureAlgorithm.name,
                version: 3, // X.509 v3
                fingerprints,
                extensions,
                rawCert: pem
            };
        } catch (error) {
            return {
                index,
                commonName: this.translateService.instant('certificates.viewer.parseError'),
                issuerCommonName: this.translateService.instant('unknown'),
                serialNumber: 'N/A',
                notBefore: new Date(),
                notAfter: new Date(),
                subjectAltNames: [],
                publicKeyAlgorithm: this.translateService.instant('unknown'),
                signatureAlgorithm: this.translateService.instant('unknown'),
                version: 3,
                fingerprints: { sha256: 'N/A', sha1: 'N/A' },
                extensions: [],
                rawCert: pem
            };
        }
    }

    private parseDistinguishedName(dn: string): { [key: string]: string } {
        const result: { [key: string]: string } = {};
        const parts = dn.split(',');

        for (const part of parts) {
            const [key, ...valueParts] = part.trim().split('=');
            if (key && valueParts.length > 0) {
                result[key.trim()] = valueParts.join('=').trim();
            }
        }

        return result;
    }

    private parseSubjectAltNames(extension: any): { type: string; value: string }[] {
        if (!extension) return [];

        try {
            // The extension value is an ArrayBuffer, we need to decode it properly
            const value = extension.value;

            if (value instanceof ArrayBuffer) {
                // Decode the ArrayBuffer to text
                const decoder = new TextDecoder('utf-8');
                const decoded = decoder.decode(value);

                // Extract different types of names from the decoded text
                const result: { type: string; value: string }[] = [];

                // The decoded data contains binary with various names
                // We need to extract readable strings
                const readableStrings = decoded.match(/[\x20-\x7E]{3,}/g) || [];

                readableStrings.forEach(str => {
                    // Check if it looks like a domain (DNS Name)
                    if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}$/.test(str) || /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(str)) {
                        if (!result.find(r => r.value === str)) {
                            result.push({ type: this.translateService.instant('certificates.viewer.dnsName'), value: str });
                        }
                    }
                    // Check if it looks like an IP address
                    else if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(str)) {
                        if (!result.find(r => r.value === str)) {
                            result.push({ type: this.translateService.instant('certificates.viewer.ipAddress'), value: str });
                        }
                    }
                    // Check if it looks like an email
                    else if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(str)) {
                        if (!result.find(r => r.value === str)) {
                            result.push({ type: this.translateService.instant('certificates.viewer.email'), value: str });
                        }
                    }
                    // Check if it looks like a URI
                    else if (/^https?:\/\/.+/.test(str)) {
                        if (!result.find(r => r.value === str)) {
                            result.push({ type: 'URI', value: str });
                        }
                    }
                });

                return result;
            }

            // Fallback to string parsing
            const strValue = value?.toString() || '';
            const result: { type: string; value: string }[] = [];

            const dnsMatches = strValue.match(/DNS:([^,\s]+)/g);
            if (dnsMatches) {
                dnsMatches.forEach((match: string) => {
                    result.push({ type: this.translateService.instant('certificates.viewer.dnsName'), value: match.replace('DNS:', '') });
                });
            }

            return result;

        } catch (error) {
        }

        return [];
    }

    private async getPublicKeyDetails(cert: X509Certificate): Promise<{ size?: number; exponent?: string; modulus?: string }> {
        try {
            const algorithm = cert.publicKey.algorithm.name;
            if (algorithm.includes('RSA')) {
                try {
                    // Parse the public key using @peculiar/x509
                    const publicKeyInfo = cert.publicKey as any;

                    // The public key data is in the rawData
                    const spki = publicKeyInfo.rawData;

                    // Import as CryptoKey first
                    const cryptoKey = await crypto.subtle.importKey(
                        'spki',
                        spki,
                        {
                            name: 'RSASSA-PKCS1-v1_5',
                            hash: 'SHA-256'
                        },
                        true,
                        ['verify']
                    );

                    // Now export as JWK
                    const jwk: any = await crypto.subtle.exportKey('jwk', cryptoKey);

                    // Calculate key size from modulus (n parameter in JWK)
                    let keySize: number | undefined;
                    if (jwk.n) {
                        // The modulus is base64url encoded, decode to get byte length
                        const modulusBytes = atob(jwk.n.replace(/-/g, '+').replace(/_/g, '/')).length;
                        keySize = modulusBytes * 8; // Convert bytes to bits
                    }

                    return {
                        size: keySize,
                        exponent: jwk.e ? this.base64ToDec(jwk.e) : undefined,
                        modulus: jwk.n ? this.base64ToHex(jwk.n) : undefined
                    };
                } catch (exportError) {
                    return { size: undefined, exponent: undefined, modulus: undefined };
                }
            } else if (algorithm.includes('EC')) {
                // For EC keys, try to determine curve size
                const ecAlg = cert.publicKey.algorithm as any;
                if (ecAlg.namedCurve) {
                    const curveSizes: { [key: string]: number } = {
                        'P-256': 256,
                        'P-384': 384,
                        'P-521': 521
                    };
                    return { size: curveSizes[ecAlg.namedCurve] || undefined };
                }
                return { size: 256 }; // Default EC size
            }
        } catch (error) {
        }
        return { size: undefined, exponent: undefined, modulus: undefined };
    }

    private base64ToDec(base64: string): string {
        try {
            const binary = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
            let decimal = 0;
            for (let i = 0; i < binary.length; i++) {
                decimal = decimal * 256 + binary.charCodeAt(i);
            }
            return decimal.toString();
        } catch (error) {
            return 'N/A';
        }
    }

    private base64ToHex(base64: string): string {
        try {
            const binary = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
            let hex = '';
            for (let i = 0; i < binary.length; i++) {
                const byte = binary.charCodeAt(i).toString(16).padStart(2, '0');
                hex += byte;
                if (i < binary.length - 1 && (i + 1) % 16 === 0) {
                    hex += '\n';
                } else if (i < binary.length - 1) {
                    hex += ':';
                }
            }
            return hex.toUpperCase();
        } catch (error) {
            return 'N/A';
        }
    }

    private async calculateFingerprints(rawData: ArrayBuffer): Promise<{ sha256: string; sha1: string }> {
        try {
            // Calculate SHA-256 fingerprint
            const sha256Hash = await crypto.subtle.digest('SHA-256', rawData);
            const sha256 = this.bufferToHex(sha256Hash);

            // Calculate SHA-1 fingerprint
            const sha1Hash = await crypto.subtle.digest('SHA-1', rawData);
            const sha1 = this.bufferToHex(sha1Hash);

            return { sha256, sha1 };
        } catch (error) {
            return {
                sha256: this.translateService.instant('certificates.viewer.parseError'),
                sha1: this.translateService.instant('certificates.viewer.parseError')
            };
        }
    }

    private parseExtensions(cert: X509Certificate): CertificateExtension[] {
        const extensions: CertificateExtension[] = [];

        try {
            // Parse Key Usage
            try {
                const keyUsageExt = cert.getExtension('2.5.29.15');
                if (keyUsageExt) {
                    const keyUsage = new Uint8Array(keyUsageExt.value as ArrayBuffer);
                    const usages: string[] = [];

                    // Key Usage is a BIT STRING in ASN.1 DER
                    // Format: tag(0x03) + length + unusedBits + actual bits
                    // Skip to the actual bit flags (after tag, length, and unused bits indicator)
                    let flagByte: number;

                    if (keyUsage[0] === 0x03) {
                        // BIT STRING tag found
                        // keyUsage[1] = length
                        // keyUsage[2] = number of unused bits in last byte
                        // keyUsage[3] = first byte of actual flags
                        flagByte = keyUsage[3];
                    } else {
                        // Already unwrapped, first byte might be unused bits indicator
                        flagByte = keyUsage[1];
                    }

                    // Decode bit flags (reading from left to right, MSB first)
                    if (flagByte & 0x80) usages.push(this.translateService.instant('certificates.viewer.digitalSignature'));
                    if (flagByte & 0x40) usages.push(this.translateService.instant('certificates.viewer.nonRepudiation'));
                    if (flagByte & 0x20) usages.push(this.translateService.instant('certificates.viewer.keyEncipherment'));
                    if (flagByte & 0x10) usages.push(this.translateService.instant('certificates.viewer.dataEncipherment'));
                    if (flagByte & 0x08) usages.push(this.translateService.instant('certificates.viewer.keyAgreement'));
                    if (flagByte & 0x04) usages.push(this.translateService.instant('certificates.viewer.certificateSigning'));
                    if (flagByte & 0x02) usages.push(this.translateService.instant('certificates.viewer.crlSigning'));
                    if (flagByte & 0x01) usages.push(this.translateService.instant('certificates.viewer.encipherOnly'));

                    extensions.push({
                        name: this.translateService.instant('certificates.viewer.keyUsage'),
                        value: [{
                            label: this.translateService.instant('certificates.viewer.usages'),
                            value: usages.join(', ')
                        }],
                        critical: keyUsageExt.critical || false
                    });
                }
            } catch (e) { /* Extension not present */ }

            // Parse Extended Key Usage
            try {
                const extKeyUsageExt = cert.getExtension('2.5.29.37');
                if (extKeyUsageExt) {
                    const data = new Uint8Array(extKeyUsageExt.value as ArrayBuffer);
                    const usages: string[] = [];

                    // Complete map of EKU OIDs (RFC 5280 and common extensions)
                    const ekuMap: { [key: string]: string } = {
                        // RFC 5280 standard usages
                        '1.3.6.1.5.5.7.3.1': this.translateService.instant('certificates.viewer.serverAuth'),
                        '1.3.6.1.5.5.7.3.2': this.translateService.instant('certificates.viewer.clientAuth'),
                        '1.3.6.1.5.5.7.3.3': this.translateService.instant('certificates.viewer.codeSigning'),
                        '1.3.6.1.5.5.7.3.4': this.translateService.instant('certificates.viewer.emailProtection'),
                        '1.3.6.1.5.5.7.3.5': this.translateService.instant('certificates.viewer.ipsecEndSystem'),
                        '1.3.6.1.5.5.7.3.6': this.translateService.instant('certificates.viewer.ipsecTunnel'),
                        '1.3.6.1.5.5.7.3.7': this.translateService.instant('certificates.viewer.ipsecUser'),
                        '1.3.6.1.5.5.7.3.8': this.translateService.instant('certificates.viewer.timeStamping'),
                        '1.3.6.1.5.5.7.3.9': this.translateService.instant('certificates.viewer.ocspSigning'),
                        '1.3.6.1.5.5.7.3.10': this.translateService.instant('certificates.viewer.dvcs'),
                        '1.3.6.1.5.5.7.3.11': this.translateService.instant('certificates.viewer.sbgpCertAAServerAuth'),
                        '1.3.6.1.5.5.7.3.13': this.translateService.instant('certificates.viewer.eapOverPPP'),
                        '1.3.6.1.5.5.7.3.14': this.translateService.instant('certificates.viewer.eapOverLAN'),
                        // Microsoft specific
                        '1.3.6.1.4.1.311.10.3.1': this.translateService.instant('certificates.viewer.msCodeSigning'),
                        '1.3.6.1.4.1.311.10.3.2': this.translateService.instant('certificates.viewer.msIndividualCodeSigning'),
                        '1.3.6.1.4.1.311.10.3.3': this.translateService.instant('certificates.viewer.msCommercialCodeSigning'),
                        '1.3.6.1.4.1.311.10.3.4': this.translateService.instant('certificates.viewer.msTrustListSigning'),
                        '1.3.6.1.4.1.311.10.3.10': this.translateService.instant('certificates.viewer.msQualifiedSubordination'),
                        '1.3.6.1.4.1.311.10.3.12': this.translateService.instant('certificates.viewer.msDocumentSigning'),
                        '1.3.6.1.4.1.311.20.2.2': this.translateService.instant('certificates.viewer.msSmartcardLogon'),
                        '1.3.6.1.4.1.311.21.6': this.translateService.instant('certificates.viewer.msKeyRecoveryAgent'),
                        // Apple specific
                        '1.2.840.113635.100.4.8': this.translateService.instant('certificates.viewer.appleCodeSigning'),
                        '1.2.840.113635.100.4.9': this.translateService.instant('certificates.viewer.appleSoftwareUpdateSigning'),
                        // Adobe specific
                        '1.2.840.113583.1.1.5': this.translateService.instant('certificates.viewer.adobePdfSigning'),
                        // Other common usages
                        '1.3.6.1.4.1.311.2.1.21': this.translateService.instant('certificates.viewer.certificateRequestAgent'),
                        '1.3.6.1.4.1.311.2.1.22': this.translateService.instant('certificates.viewer.ctlUsage'),
                        '2.5.29.37.0': this.translateService.instant('certificates.viewer.anyExtendedKeyUsage')
                    };

                    // Parse ASN.1 DER encoded OIDs
                    // Look for OID tags (0x06) in the data
                    let i = 0;
                    while (i < data.length) {
                        if (data[i] === 0x06) { // OID tag
                            i++;
                            const length = data[i];
                            i++;

                            if (i + length <= data.length) {
                                const oidBytes = data.slice(i, i + length);
                                const oid = this.decodeOid(oidBytes);

                                if (ekuMap[oid]) {
                                    usages.push(ekuMap[oid]);
                                } else {
                                    usages.push(oid); // Show raw OID if not mapped
                                }

                                i += length;
                            } else {
                                break;
                            }
                        } else {
                            i++;
                        }
                    }

                    extensions.push({
                        name: this.translateService.instant('certificates.viewer.extendedKeyUsage'),
                        value: [{
                            label: this.translateService.instant('certificates.viewer.usages'),
                            value: usages.length > 0 ? usages.join(', ') : 'N/A',
                        }],
                        critical: extKeyUsageExt.critical || false
                    });
                }
            } catch (e) { /* Extension not present */ }

            // Parse Basic Constraints
            try {
                const basicConstraintsExt = cert.getExtension('2.5.29.19');
                if (basicConstraintsExt) {
                    const data = new Uint8Array(basicConstraintsExt.value as ArrayBuffer);
                    const isCA = data.length > 0 && data[data.length - 1] === 0xFF;

                    extensions.push({
                        name: this.translateService.instant('certificates.viewer.basicConstraints'),
                        value: [{
                            label: this.translateService.instant('certificates.viewer.ca'),
                            value: (isCA ? this.translateService.instant('yes') : this.translateService.instant('no')),
                        }],
                        critical: basicConstraintsExt.critical || false
                    });
                }
            } catch (e) { /* Extension not present */ }

            // Parse Subject Key Identifier
            try {
                const skiExt = cert.getExtension('2.5.29.14');
                if (skiExt) {
                    const data = new Uint8Array(skiExt.value as ArrayBuffer);
                    // Skip ASN.1 tag and length bytes to get the actual key ID
                    let offset = 0;
                    if (data[0] === 0x04) { // OCTET STRING tag
                        offset = 2;
                    }
                    const keyId = data.slice(offset);
                    const hexValue = Array.from(keyId)
                        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
                        .join(':');

                    extensions.push({
                        name: this.translateService.instant('certificates.viewer.subjectKeyIdentifier'),
                        value: [{
                            label: this.translateService.instant('certificates.viewer.keyId'),
                            value: hexValue,
                            class: "font-mono"
                        }],
                        critical: skiExt.critical || false
                    });
                }
            } catch (e) { /* Extension not present */ }

            // Parse Authority Key Identifier
            try {
                const akiExt = cert.getExtension('2.5.29.35');
                if (akiExt) {
                    const data = new Uint8Array(akiExt.value as ArrayBuffer);
                    // Skip ASN.1 structure to find key ID (tag 0x80)
                    let keyId: Uint8Array | null = null;
                    for (let i = 0; i < data.length - 1; i++) {
                        if (data[i] === 0x80) { // Context-specific tag for keyIdentifier
                            const length = data[i + 1];
                            keyId = data.slice(i + 2, i + 2 + length);
                            break;
                        }
                    }

                    if (keyId) {
                        const hexValue = Array.from(keyId)
                            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
                            .join(':');

                        extensions.push({
                            name: this.translateService.instant('certificates.viewer.authorityKeyIdentifier'),
                            value: [{
                                label: this.translateService.instant('certificates.viewer.keyId'),
                                value: hexValue,
                                class: "font-mono"
                            }],
                            critical: akiExt.critical || false
                        });
                    }
                }
            } catch (e) { /* Extension not present */ }

            // Parse Authority Information Access (AIA)
            try {
                const aiaExt = cert.getExtension('1.3.6.1.5.5.7.1.1');
                if (aiaExt) {
                    const data = new Uint8Array(aiaExt.value as ArrayBuffer);
                    const aiaInfo: CertificateExtensionData[] = [];

                    // AIA structure: SEQUENCE of AccessDescription
                    // Each AccessDescription: SEQUENCE { accessMethod OID, accessLocation GeneralName }
                    // OIDs: 1.3.6.1.5.5.7.48.1 = OCSP, 1.3.6.1.5.5.7.48.2 = CA Issuers

                    let i = 0;
                    while (i < data.length) {
                        // Look for OID tag (0x06)
                        if (data[i] === 0x06) {
                            i++;
                            const oidLength = data[i];
                            i++;

                            if (i + oidLength <= data.length) {
                                const oidBytes = data.slice(i, i + oidLength);
                                const oid = this.decodeOid(oidBytes);
                                i += oidLength;

                                // Determine method from OID
                                let method = 'Other';
                                if (oid === '1.3.6.1.5.5.7.48.1') {
                                    method = 'OCSP';
                                } else if (oid === '1.3.6.1.5.5.7.48.2') {
                                    method = 'CA Issuers';
                                }

                                // Now look for the URL (context-specific tag [6] = 0x86 for uniformResourceIdentifier)
                                while (i < data.length && data[i] !== 0x86 && data[i] !== 0x06) {
                                    i++;
                                }

                                if (i < data.length && data[i] === 0x86) {
                                    i++;
                                    const urlLength = data[i];
                                    i++;

                                    if (i + urlLength <= data.length) {
                                        const urlBytes = data.slice(i, i + urlLength);
                                        const url = new TextDecoder('utf-8').decode(urlBytes);

                                        aiaInfo.push({
                                            label: this.translateService.instant('certificates.viewer.address'),
                                            value: url
                                        });
                                        aiaInfo.push({
                                            label: this.translateService.instant('certificates.viewer.method'),
                                            value: method
                                        });

                                        i += urlLength;
                                    }
                                }
                            }
                        } else {
                            i++;
                        }
                    }

                    if (aiaInfo.length > 0) {
                        extensions.push({
                            name: this.translateService.instant('certificates.viewer.authorityInfoAccess'),
                            value: aiaInfo,
                            critical: aiaExt.critical || false
                        });
                    }
                }
            } catch (e) { /* Extension not present */ }

            // Parse Certificate Policies
            try {
                const policiesExt = cert.getExtension('2.5.29.32');
                if (policiesExt) {
                    const data = new Uint8Array(policiesExt.value as ArrayBuffer);
                    const policies: CertificateExtensionData[] = [];

                    // Complete map of policy OIDs
                    const policyMap: { [key: string]: string } = {
                        // CA/Browser Forum Baseline Requirements
                        '2.23.140.1.2.1': this.translateService.instant('certificates.viewer.domainValidation'),
                        '2.23.140.1.2.2': this.translateService.instant('certificates.viewer.organizationValidation'),
                        '2.23.140.1.2.3': this.translateService.instant('certificates.viewer.extendedValidation'),
                        // Let's Encrypt
                        '1.3.6.1.4.1.44947.1.1.1': this.translateService.instant('certificates.viewer.letsEncryptDV'),
                        // DigiCert
                        '2.16.840.1.114412.1.1': this.translateService.instant('certificates.viewer.digicertEV'),
                        '2.16.840.1.114412.1.2': this.translateService.instant('certificates.viewer.digicertOV'),
                        '2.16.840.1.114412.1.3': this.translateService.instant('certificates.viewer.digicertDV'),
                        '2.16.840.1.114412.2.1': this.translateService.instant('certificates.viewer.digicertEVCodeSigning'),
                        // Comodo/Sectigo
                        '1.3.6.1.4.1.6449.1.2.1.3.1': this.translateService.instant('certificates.viewer.comodoEV'),
                        '1.3.6.1.4.1.6449.1.2.1.3.2': this.translateService.instant('certificates.viewer.comodoOV'),
                        '1.3.6.1.4.1.6449.1.2.1.3.4': this.translateService.instant('certificates.viewer.comodoDV'),
                        '1.3.6.1.4.1.6449.1.2.1.5.1': this.translateService.instant('certificates.viewer.comodoDV'),
                        // GlobalSign
                        '1.3.6.1.4.1.4146.1.1': this.translateService.instant('certificates.viewer.globalsignEV'),
                        '1.3.6.1.4.1.4146.1.10': this.translateService.instant('certificates.viewer.globalsignDV'),
                        '1.3.6.1.4.1.4146.1.20': this.translateService.instant('certificates.viewer.globalsignOV'),
                        // GeoTrust
                        '1.3.6.1.4.1.14370.1.6': this.translateService.instant('certificates.viewer.geotrustEV'),
                        // Thawte
                        '2.16.840.1.113733.1.7.48.1': this.translateService.instant('certificates.viewer.thawteEV'),
                        // Entrust
                        '2.16.840.1.114028.10.1.2': this.translateService.instant('certificates.viewer.entrustEV'),
                        '2.16.840.1.114028.10.1.5': this.translateService.instant('certificates.viewer.entrustOV'),
                        // IdenTrust
                        '1.3.6.1.4.1.11129.2.5.1': this.translateService.instant('certificates.viewer.identrustCA'),
                        // QuoVadis
                        '1.3.6.1.4.1.8024.0.2.100.1.2': this.translateService.instant('certificates.viewer.quovadisEV'),
                        // Generic policy qualifiers
                        '1.3.6.1.5.5.7.2.1': this.translateService.instant('certificates.viewer.cps'),
                        '1.3.6.1.5.5.7.2.2': this.translateService.instant('certificates.viewer.userNotice'),
                        // Any policy
                        '2.5.29.32.0': this.translateService.instant('certificates.viewer.anyPolicy')
                    };

                    // Parse OIDs from the data
                    let i = 0;
                    while (i < data.length) {
                        if (data[i] === 0x06) { // OID tag
                            i++;
                            const length = data[i];
                            i++;

                            if (i + length <= data.length) {
                                const oidBytes = data.slice(i, i + length);
                                const oid = this.decodeOid(oidBytes);

                                // Determine policy type from OID
                                let policyType = 'Certificate Type';
                                if (oid === '1.3.6.1.5.5.7.2.1') {
                                    policyType = 'Certification Practice Statement';
                                } else if (oid === '1.3.6.1.5.5.7.2.2') {
                                    policyType = 'User Notice';
                                } else if (oid === '2.5.29.32.0') {
                                    policyType = 'Any Policy';
                                }

                                const policyLabel = `${policyType} ( ${oid} )`;
                                const policyValue = policyMap[oid] || this.translateService.instant('unknown');

                                policies.push({
                                    label: this.translateService.instant('certificates.viewer.policy'),
                                    value: policyLabel
                                });
                                policies.push({
                                    label: this.translateService.instant('certificates.viewer.value'),
                                    value: policyValue
                                });

                                i += length;
                            } else {
                                break;
                            }
                        } else {
                            i++;
                        }
                    }

                    extensions.push({
                        name: this.translateService.instant('certificates.viewer.certificatePolicies'),
                        value: policies,
                        critical: policiesExt.critical || false
                    });
                }
            } catch (e) { /* Extension not present */ }

            // Parse Signed Certificate Timestamps (SCT)
            try {
                const sctExt = cert.getExtension('1.3.6.1.4.1.11129.2.4.2');
                if (sctExt) {
                    const data = new Uint8Array(sctExt.value as ArrayBuffer);
                    const scts: CertificateExtensionData[] = [];

                    // Check if there's an OCTET STRING wrapper (tag 0x04)
                    let offset = 0;
                    if (data[0] === 0x04) {
                        offset = 1; // Skip tag

                        // Read length (can be short or long form)
                        let wrapperLength = data[offset];
                        if (wrapperLength & 0x80) {
                            // Long form: the lower 7 bits indicate how many bytes encode the length
                            const numLengthBytes = wrapperLength & 0x7F;
                            offset += 1;
                            wrapperLength = 0;
                            for (let i = 0; i < numLengthBytes; i++) {
                                wrapperLength = (wrapperLength << 8) | data[offset + i];
                            }
                            offset += numLengthBytes;
                        } else {
                            // Short form
                            offset += 1;
                        }
                    }

                    // Read SCT list length (2 bytes, big-endian)
                    if (offset + 2 <= data.length) {
                        const listLength = (data[offset] << 8) | data[offset + 1];
                        offset += 2;

                        const listEndOffset = offset + listLength;

                        // Parse each SCT
                        while (offset < listEndOffset && offset + 2 < data.length) {
                            // Read SCT length (2 bytes)
                            const sctLength = (data[offset] << 8) | data[offset + 1];
                            offset += 2;

                            if (offset + sctLength > data.length) {
                                break;
                            }

                            // Version (1 byte)
                            const version = data[offset];
                            offset += 1;

                            // Log ID (32 bytes)
                            const logId = data.slice(offset, offset + 32);
                            const logIdHex = Array.from(logId)
                                .map(b => b.toString(16).padStart(2, '0').toUpperCase())
                                .join(':');
                            offset += 32;

                            // Timestamp (8 bytes)
                            let timestamp = 0;
                            for (let i = 0; i < 8; i++) {
                                timestamp = timestamp * 256 + data[offset + i];
                            }
                            const date = new Date(timestamp);
                            offset += 8;

                            // Extensions length (2 bytes)
                            const extLength = (data[offset] << 8) | data[offset + 1];
                            offset += 2 + extLength;

                            // Signature algorithm (2 bytes: hash + signature)
                            const hashAlg = data[offset]; // 4 = SHA-256
                            const sigAlg = data[offset + 1]; // 3 = ECDSA
                            offset += 2;

                            const hashAlgName = hashAlg === 4 ? 'SHA-256' : `Hash(${hashAlg})`;
                            const sigAlgName = sigAlg === 3 ? 'ECDSA' : sigAlg === 1 ? 'RSA' : `Sig(${sigAlg})`;

                            // Signature length and signature data
                            if (offset + 2 <= data.length) {
                                const sigLength = (data[offset] << 8) | data[offset + 1];
                                offset += 2 + sigLength;
                            }

                            scts.push({
                                label: this.translateService.instant('certificates.viewer.certificateSctLogId'),
                                value: logIdHex,
                                class: "font-mono"
                            });

                            scts.push({
                                label: this.translateService.instant('certificates.viewer.certificateSctSignatureAlgorithm'),
                                value: `${hashAlgName} ${sigAlgName}`
                            });

                            scts.push({
                                label: this.translateService.instant('certificates.viewer.certificateSctVersion'),
                                value: `${version + 1}`
                            });

                            scts.push({
                                label: this.translateService.instant('certificates.viewer.certificateSctTimestamp'),
                                value: formatDate(date, 'long', this.translateService.getCurrentLang(), 'UTC'),
                                class: "mb-4"
                            });
                        }
                    }

                    if (scts.length > 0) {
                        extensions.push({
                            name: this.translateService.instant('certificates.viewer.certificateSct'),
                            value: scts,
                            critical: sctExt.critical || false
                        });
                    }
                }
            } catch (e) {
            }

            // Parse certificate endpoint CRL

            try {
                const ext = cert.getExtension('2.5.29.31');
                if (ext) {
                    let value = 'N/A';

                    // For some extensions, try to extract readable info
                    if (ext.value instanceof ArrayBuffer) {
                        const decoder = new TextDecoder('utf-8', { fatal: false });
                        const decoded = decoder.decode(ext.value);
                        const readableStrings = decoded.match(/[\x20-\x7E]{5,}/g);

                        if (readableStrings && readableStrings.length > 0) {
                            value = readableStrings.slice(0, 3).join(', ');
                            if (readableStrings.length > 3) value += '...';
                        }
                    }

                    extensions.push({
                        name: this.translateService.instant('certificates.viewer.certificateCrl'),
                        value: [{
                            label: this.translateService.instant('certificates.viewer.certificateCrlEndpoint'),
                            value: value
                        }],
                        critical: ext.critical || false
                    });
                }
            } catch (e) { /* Extension not present */ }

        } catch (error) {
        }

        return extensions;
    }

    private decodeOid(bytes: Uint8Array): string {
        // Decode OID from DER encoding
        if (bytes.length === 0) return '';

        const result: number[] = [];

        // First byte encodes first two components
        const firstByte = bytes[0];
        result.push(Math.floor(firstByte / 40));
        result.push(firstByte % 40);

        // Remaining bytes encode subsequent components
        let value = 0;
        for (let i = 1; i < bytes.length; i++) {
            const byte = bytes[i];
            value = (value << 7) | (byte & 0x7F);

            if ((byte & 0x80) === 0) {
                result.push(value);
                value = 0;
            }
        }

        return result.join('.');
    }

    private bufferToHex(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join(':')
            .toUpperCase();
    }
}
