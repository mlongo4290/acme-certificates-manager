# DNS Provider Plugins - Developer Guide# DNS Provider Plugins - Guida per Sviluppatori



## Table of Contents## Indice

- [Overview](#overview)- [Panoramica](#panoramica)

- [Architecture](#architecture)- [Architettura](#architettura)

- [Creating a New Provider](#creating-a-new-provider)- [Creare un Nuovo Provider](#creare-un-nuovo-provider)

- [Registering the Provider](#registering-the-provider)- [Registrare il Provider](#registrare-il-provider)

- [Built-in Providers](#built-in-providers)- [Provider Integrati](#provider-integrati)

- [Best Practices](#best-practices)- [Best Practices](#best-practices)

- [Testing](#testing)- [Testing](#testing)



------



## Overview## Panoramica



The ACME Certificate Manager supports a fully extensible plugin architecture for DNS providers. This allows:Il sistema di gestione certificati ACME supporta un'architettura a plugin completamente estensibile per i provider DNS. Questo permette di:



- Adding new DNS providers without modifying core code- Aggiungere nuovi provider DNS senza modificare il codice core

- Using custom providers for private infrastructure- Utilizzare provider personalizzati per infrastrutture private

- Contributing new providers to the community- Contribuire con nuovi provider alla comunità

- Maintaining modular and testable code- Mantenere il codice modulare e testabile



## Architecture## Architettura



### Core Components### Componenti Principali



``````

backend/src/services/dns-providers/backend/src/services/dns-providers/

├── base-dns-provider.ts          # Interface and base class├── base-dns-provider.ts          # Interfaccia e classe base

├── dns-provider-factory.ts        # Factory for registration and instantiation├── dns-provider-factory.ts        # Factory per registrazione e istanziazione

├── manual-dns-provider.ts         # Fallback provider (basic example)├── manual-dns-provider.ts         # Provider fallback (esempio base)

├── cloudflare-dns-provider.ts     # Complete example with REST API├── cloudflare-dns-provider.ts     # Esempio completo con API REST

├── route53-dns-provider.ts        # Example with AWS SDK├── route53-dns-provider.ts        # Esempio con AWS SDK

└── index.ts                       # Export and registration└── index.ts                       # Esportazione e registrazione

``````



### `IDnsProvider` Interface### Interface `IDnsProvider`



Every provider must implement this interface:Ogni provider deve implementare questa interfaccia:



```typescript```typescript

export interface IDnsProvider {export interface IDnsProvider {

    readonly type: string;    readonly type: string;

        

    createTxtRecord(    createTxtRecord(

        domain: string,        domain: string,

        recordName: string,        recordName: string,

        value: string,        value: string,

        credentials: Record<string, string>        credentials: Record<string, string>

    ): Promise<void>;    ): Promise<void>;

        

    deleteTxtRecord(    deleteTxtRecord(

        domain: string,        domain: string,

        recordName: string,        recordName: string,

        credentials: Record<string, string>        credentials: Record<string, string>

    ): Promise<void>;    ): Promise<void>;

        

    validateCredentials(    validateCredentials(

        credentials: Record<string, string>        credentials: Record<string, string>

    ): Promise<{ valid: boolean; message: string }>;    ): Promise<{ valid: boolean; message: string }>;

        

    verifyTxtRecord(    getRequiredCredentials(): string[];

        domain: string,}

        recordName: string,```

        expectedValue: string,

        credentials: Record<string, string>### Classe Base `BaseDnsProvider`

    ): Promise<boolean>;

    Fornisce utilità comuni a tutti i provider:

    getRequiredCredentials(): string[];

}```typescript

```export abstract class BaseDnsProvider implements IDnsProvider {

    abstract readonly type: string;

### `BaseDnsProvider` Base Class    abstract getRequiredCredentials(): string[];

    abstract createTxtRecord(...): Promise<void>;

Provides common utilities for all providers:    abstract deleteTxtRecord(...): Promise<void>;

    abstract validateCredentials(...): Promise<{ valid: boolean; message: string }>;

```typescript    

export abstract class BaseDnsProvider implements IDnsProvider {    // Helper per validare le credenziali

    abstract readonly type: string;    protected validateRequiredCredentials(

    abstract getRequiredCredentials(): string[];        credentials: Record<string, string>,

    abstract createTxtRecord(...): Promise<void>;        required: string[]

    abstract deleteTxtRecord(...): Promise<void>;    ): void;

    abstract validateCredentials(...): Promise<{ valid: boolean; message: string }>;}

    ```

    // Default implementation using dns.promises (can be overridden)

    async verifyTxtRecord(...): Promise<boolean>;---

    

    // Helper to validate credentials## Creare un Nuovo Provider

    protected validateRequiredCredentials(

        credentials: Record<string, string>,### Step 1: Creare il File del Provider

        required: string[]

    ): void;Crea un nuovo file in `backend/src/services/dns-providers/`:

}

``````typescript

// my-dns-provider.ts

---import { BaseDnsProvider } from './base-dns-provider';



## Creating a New Provider/**

 * Provider per il servizio MyDNS

### Step 1: Create the Provider File * Richiede: apiKey, apiSecret, zoneId

 */

Create a new file in `backend/src/services/dns-providers/`:export class MyDnsProvider extends BaseDnsProvider {

    readonly type = 'mydns';  // Identificatore univoco

```typescript    

// my-dns-provider.ts    getRequiredCredentials(): string[] {

import { BaseDnsProvider } from './base-dns-provider';        return ['apiKey', 'apiSecret', 'zoneId'];

    }

/**    

 * Provider for MyDNS service    async createTxtRecord(

 * Requires: apiKey, apiSecret, zoneId        domain: string,

 */        recordName: string,

export class MyDnsProvider extends BaseDnsProvider {        value: string,

    readonly type = 'mydns';  // Unique identifier        credentials: Record<string, string>

        ): Promise<void> {

    getRequiredCredentials(): string[] {        // Valida le credenziali obbligatorie

        return ['apiKey', 'apiSecret', 'zoneId'];        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

    }        

            const { apiKey, apiSecret, zoneId } = credentials;

    async createTxtRecord(        

        domain: string,        // Implementa la logica per creare il record DNS

        recordName: string,        const response = await fetch(`https://api.mydns.com/zones/${zoneId}/records`, {

        value: string,            method: 'POST',

        credentials: Record<string, string>            headers: {

    ): Promise<void> {                'Authorization': `Bearer ${apiKey}`,

        // Validate required credentials                'Content-Type': 'application/json'

        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());            },

                    body: JSON.stringify({

        const { apiKey, apiSecret, zoneId } = credentials;                type: 'TXT',

                        name: recordName,

        // Implement DNS record creation logic                content: value,

        const response = await fetch(`https://api.mydns.com/zones/${zoneId}/records`, {                ttl: 300

            method: 'POST',            })

            headers: {        });

                'Authorization': `Bearer ${apiKey}`,        

                'Content-Type': 'application/json'        if (!response.ok) {

            },            const error = await response.json();

            body: JSON.stringify({            throw new Error(`MyDNS API error: ${error.message}`);

                type: 'TXT',        }

                name: recordName,    }

                content: value,    

                ttl: 300    async deleteTxtRecord(

            })        domain: string,

        });        recordName: string,

                credentials: Record<string, string>

        if (!response.ok) {    ): Promise<void> {

            const error = await response.json();        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

            throw new Error(`MyDNS API error: ${error.message}`);        

        }        const { apiKey, apiSecret, zoneId } = credentials;

    }        

            // 1. Trova il record

    async deleteTxtRecord(        const listResponse = await fetch(

        domain: string,            `https://api.mydns.com/zones/${zoneId}/records?type=TXT&name=${recordName}`,

        recordName: string,            {

        credentials: Record<string, string>                headers: { 'Authorization': `Bearer ${apiKey}` }

    ): Promise<void> {            }

        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());        );

                

        const { apiKey, apiSecret, zoneId } = credentials;        const records = await listResponse.json();

                

        // 1. Find the record        if (records.length === 0) {

        const listResponse = await fetch(            return;

            `https://api.mydns.com/zones/${zoneId}/records?type=TXT&name=${recordName}`,        }

            {        

                headers: { 'Authorization': `Bearer ${apiKey}` }        // 2. Elimina il record

            }        const deleteResponse = await fetch(

        );            `https://api.mydns.com/zones/${zoneId}/records/${records[0].id}`,

                    {

        const records = await listResponse.json();                method: 'DELETE',

                        headers: { 'Authorization': `Bearer ${apiKey}` }

        if (records.length === 0) {            }

            return; // Already deleted        );

        }        

                if (!deleteResponse.ok) {

        // 2. Delete the record            throw new Error(`Failed to delete record: ${deleteResponse.statusText}`);

        const deleteResponse = await fetch(        }

            `https://api.mydns.com/zones/${zoneId}/records/${records[0].id}`,    }

            {    

                method: 'DELETE',    async validateCredentials(

                headers: { 'Authorization': `Bearer ${apiKey}` }        credentials: Record<string, string>

            }    ): Promise<{ valid: boolean; message: string }> {

        );        try {

                    this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        if (!deleteResponse.ok) {            

            throw new Error(`Failed to delete record: ${deleteResponse.statusText}`);            const { apiKey, zoneId } = credentials;

        }            

    }            // Testa la connessione

                const response = await fetch(

    async validateCredentials(                `https://api.mydns.com/zones/${zoneId}`,

        credentials: Record<string, string>                {

    ): Promise<{ valid: boolean; message: string }> {                    headers: { 'Authorization': `Bearer ${apiKey}` }

        try {                }

            this.validateRequiredCredentials(credentials, this.getRequiredCredentials());            );

                        

            const { apiKey, zoneId } = credentials;            if (response.ok) {

                            const zone = await response.json();

            // Test connection                return {

            const response = await fetch(                    valid: true,

                `https://api.mydns.com/zones/${zoneId}`,                    message: `Connected to zone: ${zone.name}`

                {                };

                    headers: { 'Authorization': `Bearer ${apiKey}` }            } else {

                }                return {

            );                    valid: false,

                                message: `Invalid credentials: ${response.statusText}`

            if (response.ok) {                };

                const zone = await response.json();            }

                return {        } catch (error: any) {

                    valid: true,            return {

                    message: `Connected to zone: ${zone.name}`                valid: false,

                };                message: `Connection error: ${error.message}`

            } else {            };

                return {        }

                    valid: false,    }

                    message: `Invalid credentials: ${response.statusText}`}

                };```

            }

        } catch (error: any) {### Step 2: Gestione delle Credenziali

            return {

                valid: false,Le credenziali vengono salvate come `Map<string, string>` nel database. Il tuo provider deve:

                message: `Connection error: ${error.message}`

            };1. Specificare le credenziali obbligatorie in `getRequiredCredentials()`

        }2. Validarle con `validateRequiredCredentials()` (fornito dalla classe base)

    }3. Usarle per autenticare le chiamate API

    

    /****Esempio con credenziali opzionali:**

     * Optional: Override to use provider's API instead of DNS resolver

     * If not overridden, uses default implementation from BaseDnsProvider```typescript

     */getRequiredCredentials(): string[] {

    async verifyTxtRecord(    return ['apiKey', 'apiSecret'];  // Solo i campi obbligatori

        domain: string,}

        recordName: string,

        expectedValue: string,async createTxtRecord(..., credentials: Record<string, string>): Promise<void> {

        credentials: Record<string, string>    this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

    ): Promise<boolean> {    

        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());    const { apiKey, apiSecret, region } = credentials;

            const finalRegion = region || 'us-east-1';  // Valore di default

        const { apiKey, zoneId } = credentials;    

            // ... usa finalRegion

        // Use provider API to check if record exists}

        const response = await fetch(```

            `https://api.mydns.com/zones/${zoneId}/records?type=TXT&name=${recordName}`,

            {### Step 3: Gestione degli Errori

                headers: { 'Authorization': `Bearer ${apiKey}` }

            }Segui queste best practices:

        );

        ```typescript

        if (!response.ok) {async createTxtRecord(...): Promise<void> {

            return false;    try {

        }        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

                

        const records = await response.json();        const response = await fetch(...);

        return records.some((record: any) => record.content === expectedValue);        

    }        if (!response.ok) {

}            // Fornisci errori descrittivi

```            const error = await response.json();

            throw new Error(

### Step 2: Credential Management                `Failed to create DNS record: ${error.message || response.statusText}\n` +

                `Domain: ${domain}, Record: ${recordName}`

Credentials are stored as `Map<string, string>` in the database. Your provider must:            );

        }

1. Specify required credentials in `getRequiredCredentials()`        

2. Validate them with `validateRequiredCredentials()` (provided by base class)    } catch (error: any) {

3. Use them to authenticate API calls        // Rilancia con contesto aggiuntivo

        throw new Error(`MyDNS provider error: ${error.message}`);

**Example with optional credentials:**    }

}

```typescript```

getRequiredCredentials(): string[] {

    return ['apiKey', 'apiSecret'];  // Only required fields---

}

## Registrare il Provider

async createTxtRecord(..., credentials: Record<string, string>): Promise<void> {

    this.validateRequiredCredentials(credentials, this.getRequiredCredentials());### Nel File `index.ts`

    

    const { apiKey, apiSecret, region } = credentials;Dopo aver creato il provider, registralo nel factory:

    const finalRegion = region || 'us-east-1';  // Default value

    ```typescript

    // ... use finalRegion// 1. Esporta il provider

}export * from './my-dns-provider';

```

// 2. Importa la classe

### Step 3: Error Handlingimport { MyDnsProvider } from './my-dns-provider';



Follow these best practices:// 3. Registra nel factory

DnsProviderFactory.registerProvider('mydns', MyDnsProvider);

```typescript```

async createTxtRecord(...): Promise<void> {

    try {**File completo:**

        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        ```typescript

        const response = await fetch(...);// backend/src/services/dns-providers/index.ts

        

        if (!response.ok) {// Esportazioni

            // Provide descriptive errorsexport * from './base-dns-provider';

            const error = await response.json();export * from './dns-provider-factory';

            throw new Error(export * from './manual-dns-provider';

                `Failed to create DNS record: ${error.message || response.statusText}\n` +export * from './cloudflare-dns-provider';

                `Domain: ${domain}, Record: ${recordName}`export * from './my-dns-provider';  // ← Aggiungi qui

            );

        }// Import per registrazione

        import { DnsProviderFactory } from './dns-provider-factory';

    } catch (error: any) {import { ManualDnsProvider } from './manual-dns-provider';

        // Re-throw with additional contextimport { CloudflareDnsProvider } from './cloudflare-dns-provider';

        throw new Error(`MyDNS provider error: ${error.message}`);import { MyDnsProvider } from './my-dns-provider';  // ← Aggiungi qui

    }

}// Registra tutti i provider

```DnsProviderFactory.registerProvider('manual', ManualDnsProvider);

DnsProviderFactory.registerProvider('cloudflare', CloudflareDnsProvider);

---DnsProviderFactory.registerProvider('mydns', MyDnsProvider);  // ← Aggiungi qui

```

## Registering the Provider

### Verifica Registrazione

### In `index.ts` File

Il tuo provider è ora disponibile! L'applicazione lo caricherà automaticamente.

After creating the provider, register it in the factory:

```typescript

```typescript// Nel codice ACME

// 1. Export the providerconst provider = DnsProviderFactory.getProvider('mydns');

export * from './my-dns-provider';await provider.createTxtRecord(domain, recordName, value, credentials);

```

// 2. Import the class

import { MyDnsProvider } from './my-dns-provider';---



// 3. Register in factory## Provider Integrati

DnsProviderFactory.registerProvider('mydns', MyDnsProvider);

```### 1. **Manual** (Fallback)

- **Tipo:** `manual`

**Complete file:**- **Credenziali:** Nessuna

- **Funzionalità:** Stampa istruzioni per creazione manuale dei record

```typescript- **Uso:** Provider di fallback quando il tipo non è riconosciuto

// backend/src/services/dns-providers/index.ts

### 2. **Cloudflare** ✅ Completamente Implementato

// Exports- **Tipo:** `cloudflare`

export * from './base-dns-provider';- **Credenziali:** `apiToken`, `zoneId`

export * from './dns-provider-factory';- **API:** Cloudflare API v4

export * from './manual-dns-provider';- **Features:** Create, Delete, Validate

export * from './cloudflare-dns-provider';- **Esempio:** Implementazione completa con native fetch API

export * from './my-dns-provider';  // ← Add here

### 3. **DigitalOcean** ✅ Completamente Implementato

// Imports for registration- **Tipo:** `digitalocean`

import { DnsProviderFactory } from './dns-provider-factory';- **Credenziali:** `apiToken`

import { ManualDnsProvider } from './manual-dns-provider';- **API:** DigitalOcean API v2

import { CloudflareDnsProvider } from './cloudflare-dns-provider';- **Features:** Create, Delete, Validate

import { MyDnsProvider } from './my-dns-provider';  // ← Add here

### 4. **GoDaddy** ✅ Completamente Implementato

// Register all providers- **Tipo:** `godaddy`

DnsProviderFactory.registerProvider('manual', ManualDnsProvider);- **Credenziali:** `apiKey`, `apiSecret`

DnsProviderFactory.registerProvider('cloudflare', CloudflareDnsProvider);- **API:** GoDaddy Domains API

DnsProviderFactory.registerProvider('mydns', MyDnsProvider);  // ← Add here- **Features:** Create, Delete, Validate

```

### 5. **Namecheap** ✅ Completamente Implementato

### Verify Registration- **Tipo:** `namecheap`

- **Credenziali:** `apiUser`, `apiKey`, `clientIp`

Your provider is now available! The application will load it automatically.- **API:** Namecheap Domains API

- **Note:** Richiede IP whitelisting nel dashboard

```typescript

// In ACME code### 6. **AWS Route53** 🔧 Richiede SDK

const provider = DnsProviderFactory.getProvider('mydns');- **Tipo:** `route53`

await provider.createTxtRecord(domain, recordName, value, credentials);- **Credenziali:** `accessKeyId`, `secretAccessKey`, `hostedZoneId`, `region` (opzionale)

```- **SDK:** `@aws-sdk/client-route53`

- **Install:** `npm install @aws-sdk/client-route53`

---

### 7. **Google Cloud DNS** 🔧 Richiede SDK

## Built-in Providers- **Tipo:** `google`

- **Credenziali:** `projectId`, `keyFile` (service account JSON), `managedZone`

### 1. **Manual** (Fallback)- **SDK:** `@google-cloud/dns`

- **Type:** `manual`- **Install:** `npm install @google-cloud/dns`

- **Credentials:** None

- **Functionality:** Displays instructions for manual record creation### 8. **Azure DNS** 🔧 Richiede SDK

- **Use:** Fallback provider when type is not recognized- **Tipo:** `azure`

- **Credenziali:** `subscriptionId`, `resourceGroupName`, `zoneName`, `tenantId`, `clientId`, `clientSecret`

### 2. **Cloudflare** ✅ Fully Implemented- **SDK:** `@azure/arm-dns`, `@azure/identity`

- **Type:** `cloudflare`- **Install:** `npm install @azure/arm-dns @azure/identity`

- **Credentials:** `apiToken`, `zoneId` (optional)

- **API:** Cloudflare API v4### 9. **OVH** 🔧 Richiede SDK

- **Features:** Create, Delete, Validate, Verify (API-based)- **Tipo:** `ovh`

- **Example:** Complete implementation with native fetch API- **Credenziali:** `endpoint`, `applicationKey`, `applicationSecret`, `consumerKey`, `zoneName`

- **SDK:** `ovh`

### 3. **DigitalOcean** ✅ Fully Implemented- **Install:** `npm install ovh`

- **Type:** `digitalocean`

- **Credentials:** `apiToken`---

- **API:** DigitalOcean API v2

- **Features:** Create, Delete, Validate## Best Practices



### 4. **GoDaddy** ✅ Fully Implemented### 1. Naming Convention

- **Type:** `godaddy`- **Type ID:** Lowercase, senza spazi (es: `mydns`, `cloudflare`, `route53`)

- **Credentials:** `apiKey`, `apiSecret`- **Class Name:** PascalCase + "DnsProvider" suffix (es: `MyDnsProvider`)

- **API:** GoDaddy Domains API- **File Name:** Kebab-case + "-dns-provider.ts" (es: `my-dns-provider.ts`)

- **Features:** Create, Delete, Validate

### 3. TTL dei Record

### 5. **Namecheap** ✅ Fully ImplementedImposta TTL bassi per i record ACME challenge (60-300 secondi) per velocizzare la propagazione:

- **Type:** `namecheap`

- **Credentials:** `apiUser`, `apiKey`, `clientIp````typescript

- **API:** Namecheap Domains API{

- **Note:** Requires IP whitelisting in dashboard    type: 'TXT',

    name: recordName,

### 6. **AWS Route53** 🔧 Requires SDK    content: value,

- **Type:** `route53`    ttl: 300  // 5 minuti

- **Credentials:** `accessKeyId`, `secretAccessKey`, `hostedZoneId`, `region` (optional)}

- **SDK:** `@aws-sdk/client-route53````

- **Install:** `npm install @aws-sdk/client-route53`

### 4. Gestione Async

### 7. **Google Cloud DNS** 🔧 Requires SDKTutte le operazioni sono asincrone. Usa `async/await`:

- **Type:** `google`

- **Credentials:** `projectId`, `keyFile` (service account JSON), `managedZone````typescript

- **SDK:** `@google-cloud/dns`async createTxtRecord(...): Promise<void> {

- **Install:** `npm install @google-cloud/dns`    const response = await fetch(...);

    const data = await response.json();

### 8. **Azure DNS** 🔧 Requires SDK    // ...

- **Type:** `azure`}

- **Credentials:** `subscriptionId`, `resourceGroupName`, `zoneName`, `tenantId`, `clientId`, `clientSecret````

- **SDK:** `@azure/arm-dns`, `@azure/identity`

- **Install:** `npm install @azure/arm-dns @azure/identity`### 5. Idempotenza

Le operazioni dovrebbero essere idempotenti:

### 9. **OVH** 🔧 Requires SDK

- **Type:** `ovh````typescript

- **Credentials:** `endpoint`, `applicationKey`, `applicationSecret`, `consumerKey`, `zoneName`async deleteTxtRecord(...): Promise<void> {

- **SDK:** `ovh`    // Non lanciare errore se il record non esiste

- **Install:** `npm install ovh`    if (!recordExists) {

        return;  // Operazione completata con successo

---    }

    // ... elimina

## Best Practices}

```

### 1. Naming Convention

- **Type ID:** Lowercase, no spaces (e.g., `mydns`, `cloudflare`, `route53`)### 6. Domain Parsing

- **Class Name:** PascalCase + "DnsProvider" suffix (e.g., `MyDnsProvider`)Gestisci correttamente i sottodomini:

- **File Name:** Kebab-case + "-dns-provider.ts" (e.g., `my-dns-provider.ts`)

```typescript

### 2. Record TTL// Per _acme-challenge.subdomain.example.com

Set low TTL for ACME challenge records (60-300 seconds) to speed up propagation:// Domain: example.com

// RecordName: _acme-challenge.subdomain.example.com

```typescript

{// Estrai base domain

    type: 'TXT',private extractBaseDomain(domain: string): string {

    name: recordName,    const parts = domain.split('.');

    content: value,    return parts.slice(-2).join('.');  // example.com

    ttl: 300  // 5 minutes}

}

```// Estrai subdomain

const subdomain = recordName.replace(`.${baseDomain}`, '');

### 3. Async Operations// Risultato: _acme-challenge.subdomain

All operations are asynchronous. Use `async/await`:```



```typescript### 7. Rate Limiting

async createTxtRecord(...): Promise<void> {Considera i limiti delle API:

    const response = await fetch(...);

    const data = await response.json();```typescript

    // ...async createTxtRecord(...): Promise<void> {

}    try {

```        const response = await fetch(...);

        

### 4. Idempotency        if (response.status === 429) {

Operations should be idempotent:            // Too Many Requests

            const retryAfter = response.headers.get('Retry-After');

```typescript            throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`);

async deleteTxtRecord(...): Promise<void> {        }

    // Don't throw error if record doesn't exist        

    if (!recordExists) {    } catch (error) {

        return;  // Operation completed successfully        // ...

    }    }

    // ... delete}

}```

```

---

### 5. Domain Parsing

Handle subdomains correctly:## Testing



```typescript### Test Manuale

// For _acme-challenge.subdomain.example.com

// Domain: example.com1. **Registra il provider** nel factory

// RecordName: _acme-challenge.subdomain.example.com2. **Crea un provider DNS** nell'applicazione con le credenziali

3. **Testa la validazione** delle credenziali

// Extract base domain4. **Crea un certificato** usando il provider

private extractBaseDomain(domain: string): string {5. **Verifica** che i record DNS vengano creati ed eliminati correttamente

    const parts = domain.split('.');

    return parts.slice(-2).join('.');  // example.com### Test delle Credenziali

}

Implementa `validateCredentials()` per permettere il test prima dell'uso:

// Extract subdomain

const subdomain = recordName.replace(`.${baseDomain}`, '');```typescript

// Result: _acme-challenge.subdomainasync validateCredentials(credentials: Record<string, string>) {

```    try {

        // Fai una chiamata API leggera per testare la connessione

### 6. Rate Limiting        const response = await fetch('https://api.mydns.com/account', {

Consider API rate limits:            headers: { 'Authorization': `Bearer ${credentials.apiKey}` }

        });

```typescript        

async createTxtRecord(...): Promise<void> {        if (response.ok) {

    try {            return { valid: true, message: 'Connection successful' };

        const response = await fetch(...);        } else {

                    return { valid: false, message: response.statusText };

        if (response.status === 429) {        }

            // Too Many Requests    } catch (error: any) {

            const retryAfter = response.headers.get('Retry-After');        return { valid: false, message: error.message };

            throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`);    }

        }}

        ```

    } catch (error) {

        // ...---

    }

}## Esempio Completo: Provider con SDK

```

```typescript

### 7. DNS Verificationimport { BaseDnsProvider } from './base-dns-provider';



Implement `verifyTxtRecord()` to use provider's API instead of DNS resolver:/**

 * Provider AWS Route53

```typescript * Richiede @aws-sdk/client-route53

async verifyTxtRecord( */

    domain: string,export class Route53DnsProvider extends BaseDnsProvider {

    recordName: string,    readonly type = 'route53';

    expectedValue: string,

    credentials: Record<string, string>    getRequiredCredentials(): string[] {

): Promise<boolean> {        return ['accessKeyId', 'secretAccessKey', 'hostedZoneId'];

    // Use provider's API to check if record exists with correct value    }

    // More reliable than DNS resolution, especially during propagation

        async createTxtRecord(

    const response = await fetch(`https://api.provider.com/zones/${zoneId}/records`, {        domain: string,

        headers: { 'Authorization': `Bearer ${apiKey}` }        recordName: string,

    });        value: string,

            credentials: Record<string, string>

    const records = await response.json();    ): Promise<void> {

    return records.some(record =>         this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        record.type === 'TXT' && 

        record.name === recordName &&         // Check if SDK is installed

        record.content === expectedValue        try {

    );            require.resolve('@aws-sdk/client-route53');

}        } catch {

```            throw new Error(

                'AWS Route53 provider requires @aws-sdk/client-route53. ' +

**Benefits:**                'Install with: npm install @aws-sdk/client-route53'

- Faster validation (no DNS propagation wait)            );

- More reliable (direct API query)        }

- Better error messages

- Works with non-public zones        const { Route53Client, ChangeResourceRecordSetsCommand } = require('@aws-sdk/client-route53');

        

**Note:** If not overridden, the default implementation uses Node.js `dns.promises` module.        const { accessKeyId, secretAccessKey, hostedZoneId, region } = credentials;



---        const client = new Route53Client({

            region: region || 'us-east-1',

## Testing            credentials: { accessKeyId, secretAccessKey }

        });

### Manual Testing

        const command = new ChangeResourceRecordSetsCommand({

1. **Register the provider** in factory            HostedZoneId: hostedZoneId,

2. **Create a DNS provider** in the application with credentials            ChangeBatch: {

3. **Test credential validation**                Changes: [{

4. **Create a certificate** using the provider                    Action: 'UPSERT',

5. **Verify** that DNS records are created and deleted correctly                    ResourceRecordSet: {

                        Name: recordName,

### Credential Testing                        Type: 'TXT',

                        TTL: 300,

Implement `validateCredentials()` to allow testing before use:                        ResourceRecords: [{ Value: `"${value}"` }]

                    }

```typescript                }]

async validateCredentials(credentials: Record<string, string>) {            }

    try {        });

        // Make a lightweight API call to test connection

        const response = await fetch('https://api.mydns.com/account', {        await client.send(command)

            headers: { 'Authorization': `Bearer ${credentials.apiKey}` }    }

        });

            async deleteTxtRecord(

        if (response.ok) {        domain: string,

            return { valid: true, message: 'Connection successful' };        recordName: string,

        } else {        credentials: Record<string, string>

            return { valid: false, message: response.statusText };    ): Promise<void> {

        }        // Implementazione simile...

    } catch (error: any) {    }

        return { valid: false, message: error.message };

    }    async validateCredentials(

}        credentials: Record<string, string>

```    ): Promise<{ valid: boolean; message: string }> {

        // Test connection...

### Unit Testing    }

}

```typescript```

// tests/dns-providers/my-dns-provider.test.ts

import { MyDnsProvider } from '../../src/services/dns-providers/my-dns-provider';---



describe('MyDnsProvider', () => {## Supporto e Contributi

    let provider: MyDnsProvider;

    const credentials = {### Aggiungere un Nuovo Provider al Progetto

        apiKey: 'test-key',

        apiSecret: 'test-secret',Se vuoi contribuire un nuovo provider:

        zoneId: 'test-zone'

    };1. Implementa il provider seguendo questa guida

2. Aggiungi test (se disponibili)

    beforeEach(() => {3. Documenta le credenziali richieste e come ottenerle

        provider = new MyDnsProvider();4. Crea una pull request

    });

### Domande Frequenti

    it('should have correct type', () => {

        expect(provider.type).toBe('mydns');**Q: Posso usare librerie di terze parti?**  

    });A: Sì, ma documentale come dipendenze opzionali e gestisci l'assenza del package.



    it('should return required credentials', () => {**Q: Il mio provider richiede configurazione complessa?**  

        expect(provider.getRequiredCredentials()).toEqual(['apiKey', 'apiSecret', 'zoneId']);A: Usa credenziali addizionali o crea un file di configurazione JSON da passare come stringa.

    });

**Q: Come gestisco provider con più zone/account?**  

    it('should validate credentials format', async () => {A: Crea più configurazioni DNS nell'applicazione, una per zona/account.

        const result = await provider.validateCredentials(credentials);

        expect(result).toHaveProperty('valid');**Q: Posso testare senza un dominio reale?**  

        expect(result).toHaveProperty('message');A: Implementa prima `validateCredentials()`, poi testa con un dominio di test.

    });

});---

```

## Riferimenti

---

- **RFC 8555:** ACME Protocol Specification

## Complete Example: Provider with SDK- **DNS-01 Challenge:** TXT record format `_acme-challenge.{domain}`

- **Factory Pattern:** Design pattern per registrazione dinamica

```typescript- **Node.js Fetch API:** Native in Node.js 18+

import { BaseDnsProvider } from './base-dns-provider';

---

/**

 * AWS Route53 Provider**Versione:** 1.0  

 * Requires @aws-sdk/client-route53**Ultimo aggiornamento:** Ottobre 2024

 */
export class Route53DnsProvider extends BaseDnsProvider {
    readonly type = 'route53';

    getRequiredCredentials(): string[] {
        return ['accessKeyId', 'secretAccessKey', 'hostedZoneId'];
    }

    async createTxtRecord(
        domain: string,
        recordName: string,
        value: string,
        credentials: Record<string, string>
    ): Promise<void> {
        this.validateRequiredCredentials(credentials, this.getRequiredCredentials());

        // Check if SDK is installed
        try {
            require.resolve('@aws-sdk/client-route53');
        } catch {
            throw new Error(
                'AWS Route53 provider requires @aws-sdk/client-route53. ' +
                'Install with: npm install @aws-sdk/client-route53'
            );
        }

        const { Route53Client, ChangeResourceRecordSetsCommand } = require('@aws-sdk/client-route53');
        
        const { accessKeyId, secretAccessKey, hostedZoneId, region } = credentials;

        const client = new Route53Client({
            region: region || 'us-east-1',
            credentials: { accessKeyId, secretAccessKey }
        });

        const command = new ChangeResourceRecordSetsCommand({
            HostedZoneId: hostedZoneId,
            ChangeBatch: {
                Changes: [{
                    Action: 'UPSERT',
                    ResourceRecordSet: {
                        Name: recordName,
                        Type: 'TXT',
                        TTL: 300,
                        ResourceRecords: [{ Value: `"${value}"` }]
                    }
                }]
            }
        });

        await client.send(command);
    }

    async deleteTxtRecord(
        domain: string,
        recordName: string,
        credentials: Record<string, string>
    ): Promise<void> {
        // Similar implementation...
    }

    async validateCredentials(
        credentials: Record<string, string>
    ): Promise<{ valid: boolean; message: string }> {
        // Test connection...
    }

    /**
     * Use Route53 API to verify record exists
     * More reliable than DNS resolution during propagation
     */
    async verifyTxtRecord(
        domain: string,
        recordName: string,
        expectedValue: string,
        credentials: Record<string, string>
    ): Promise<boolean> {
        const { Route53Client, ListResourceRecordSetsCommand } = require('@aws-sdk/client-route53');
        
        const { accessKeyId, secretAccessKey, hostedZoneId, region } = credentials;

        const client = new Route53Client({
            region: region || 'us-east-1',
            credentials: { accessKeyId, secretAccessKey }
        });

        const command = new ListResourceRecordSetsCommand({
            HostedZoneId: hostedZoneId,
            StartRecordName: recordName,
            StartRecordType: 'TXT',
            MaxItems: 1
        });

        const response = await client.send(command);
        
        if (!response.ResourceRecordSets || response.ResourceRecordSets.length === 0) {
            return false;
        }

        const record = response.ResourceRecordSets[0];
        
        if (record.Name !== recordName + '.' || record.Type !== 'TXT') {
            return false;
        }

        return record.ResourceRecords?.some(
            rr => rr.Value === `"${expectedValue}"`
        ) || false;
    }
}
```

---

## Support and Contributions

### Adding a New Provider to the Project

If you want to contribute a new provider:

1. Implement the provider following this guide
2. Add tests (if available)
3. Document required credentials and how to obtain them
4. Create a pull request

### Frequently Asked Questions

**Q: Can I use third-party libraries?**  
A: Yes, but document them as optional dependencies and handle package absence gracefully.

**Q: My provider requires complex configuration?**  
A: Use additional credentials or create a JSON configuration file to pass as a string.

**Q: How do I handle providers with multiple zones/accounts?**  
A: Create multiple DNS configurations in the application, one per zone/account.

**Q: Can I test without a real domain?**  
A: Implement `validateCredentials()` first, then test with a test domain.

**Q: Should I override `verifyTxtRecord()`?**  
A: It's recommended! Using the provider's API is more reliable than DNS resolution, especially during propagation. The default implementation uses Node.js DNS resolver as a fallback.

---

## References

- **RFC 8555:** ACME Protocol Specification
- **DNS-01 Challenge:** TXT record format `_acme-challenge.{domain}`
- **Factory Pattern:** Design pattern for dynamic registration
- **Node.js Fetch API:** Native in Node.js 18+

---

**Version:** 1.1  
**Last Updated:** January 2025
