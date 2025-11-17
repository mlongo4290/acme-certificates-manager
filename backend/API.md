# ACME Certificate Manager - REST API

## Panoramica

Il sistema ACME Certificate Manager offre due modalità di accesso:

1. **API Web** (`/api/*`) - Per l'applicazione web Angular con autenticazione JWT
2. **API REST v1** (`/api/v1/*`) - Per integrazioni programmatiche con autenticazione tramite API token

## Documentazione Interattiva

Accedi alla documentazione Swagger UI all'indirizzo:

```
http://localhost:3000/api/v1/docs
```

Questa interfaccia permette di:
- Esplorare tutti gli endpoint disponibili
- Testare le API direttamente dal browser
- Visualizzare schemi di request/response
- Generare esempi di codice

## Autenticazione

### 1. JWT Bearer Token (Web Application)

Utilizzato dall'applicazione web Angular:

```http
Authorization: Bearer <jwt_token>
```

Il token JWT viene ottenuto tramite login (`POST /api/auth/login`) e ha durata limitata (24h default).

### 2. API Token (Integrazioni Programmatiche)

Per accesso programmatico via API:

```http
Authorization: Bearer <api_token>
```

oppure:

```http
X-API-Key: <api_token>
```

Gli API token:
- Hanno scopes specifici (permissions granulari)
- Possono avere scadenza configurabile
- Vengono tracciati con lastUsedAt
- Possono essere revocati in qualsiasi momento

## Ruoli Utente

Il sistema supporta tre ruoli con permessi progressivi:

### READ_ONLY
- Visualizzazione certificati
- Visualizzazione DNS providers
- Visualizzazione CA e account ACME
- Visualizzazione activity logs

**Scopes disponibili:**
- `certificates:read`
- `dns-providers:read`
- `acme-ca:read`
- `acme-accounts:read`
- `activity-logs:read`

### CERT_MANAGER
Permessi di READ_ONLY più:
- Creazione/modifica/eliminazione certificati
- Emissione e rinnovo certificati
- Creazione/modifica DNS providers
- Creazione/modifica ACME accounts

**Scopes disponibili:**
- `certificates:read`, `certificates:write`, `certificates:issue`
- `dns-providers:read`, `dns-providers:write`
- `acme-ca:read`
- `acme-accounts:read`, `acme-accounts:write`
- `activity-logs:read`

### ADMIN
Accesso completo a tutte le funzionalità del sistema.

**Scopes:** `*` (tutti)

## Gestione API Tokens

### Creare un nuovo token

**Endpoint:** `POST /api/api-tokens`

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "name": "Production API Token",
  "scopes": ["certificates:read", "certificates:write"],
  "expiresInDays": 365
}
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Production API Token",
  "scopes": ["certificates:read", "certificates:write"],
  "expiresAt": "2025-11-07T10:00:00.000Z",
  "isActive": true,
  "token": "a1b2c3d4e5f6...789",
  "warning": "Save this token now. You won't be able to see it again!",
  "createdAt": "2024-11-07T10:00:00.000Z"
}
```

⚠️ **IMPORTANTE:** Il token viene mostrato solo alla creazione. Salvalo in un luogo sicuro!

### Listrare i propri token

**Endpoint:** `GET /api/api-tokens`

Restituisce tutti i token attivi dell'utente corrente (senza il valore del token).

### Eliminare un token

**Endpoint:** `DELETE /api/api-tokens/:id`

Elimina permanentemente il token.

## Esempi di Utilizzo API

### Esempio 1: Ottenere lista certificati

```bash
curl -X GET http://localhost:3000/api/v1/certificates \
  -H "X-API-Key: your_api_token_here"
```

### Esempio 2: Creare un nuovo certificato

```bash
curl -X POST http://localhost:3000/api/v1/certificates \
  -H "X-API-Key: your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "additionalDomains": ["www.example.com"],
    "challengeType": "dns-01",
    "certificateAuthority": "ca_id_here",
    "acmeAccount": "account_id_here",
    "dnsProvider": "dns_provider_id_here",
    "autoRenewal": true
  }'
```

### Esempio 3: Download certificato

```bash
curl -X GET http://localhost:3000/api/v1/certificates/{id}/download/certificate \
  -H "X-API-Key: your_api_token_here" \
  -o certificate.pem
```

### Esempio con Python

```python
import requests

API_TOKEN = "your_api_token_here"
BASE_URL = "http://localhost:3000/api/v1"

headers = {
    "X-API-Key": API_TOKEN,
    "Content-Type": "application/json"
}

# Get certificates
response = requests.get(f"{BASE_URL}/certificates", headers=headers)
certificates = response.json()

print(f"Total certificates: {certificates['totalRecords']}")
for cert in certificates['data']:
    print(f"- {cert['domain']} (expires: {cert['expiryDate']})")
```

### Esempio con Node.js

```javascript
const axios = require('axios');

const API_TOKEN = 'your_api_token_here';
const BASE_URL = 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-API-Key': API_TOKEN
  }
});

// Get certificates
async function getCertificates() {
  try {
    const response = await api.get('/certificates');
    console.log(`Total certificates: ${response.data.totalRecords}`);
    response.data.data.forEach(cert => {
      console.log(`- ${cert.domain} (expires: ${cert.expiryDate})`);
    });
  } catch (error) {
    console.error('Error:', error.response.data);
  }
}

getCertificates();
```

## Endpoints Disponibili

### Certificates
- `GET /api/v1/certificates` - Lista certificati
- `GET /api/v1/certificates/stats` - Statistiche certificati
- `GET /api/v1/certificates/:id` - Dettaglio certificato
- `POST /api/v1/certificates` - Crea certificato
- `PATCH /api/v1/certificates/:id` - Aggiorna certificato
- `DELETE /api/v1/certificates/:id` - Elimina certificato
- `GET /api/v1/certificates/:id/download/:type` - Download file certificato

### DNS Providers (TODO)
- `GET /api/v1/dns-providers` - Lista providers
- `POST /api/v1/dns-providers` - Crea provider
- E altri...

### Certificate Authorities (TODO)
- `GET /api/v1/acme-ca` - Lista CA
- E altri...

## Rate Limiting

**TODO:** Implementare rate limiting per API v1.

Limiti consigliati:
- 100 requests/minuto per utente READ_ONLY
- 500 requests/minuto per CERT_MANAGER
- 1000 requests/minuto per ADMIN

## Best Practices

1. **Sicurezza Token**
   - Non committare mai i token nel codice sorgente
   - Usa variabili d'ambiente per storage
   - Ruota i token regolarmente
   - Revoca immediatamente token compromessi

2. **Scopes Minimi**
   - Richiedi solo gli scopes necessari
   - Crea token separati per diverse integrazioni
   - Usa token READ_ONLY quando possibile

3. **Gestione Errori**
   - Implementa retry logic con backoff esponenziale
   - Gestisci errori 401 (token scaduto/invalido)
   - Gestisci errori 403 (scopes insufficienti)
   - Monitora gli errori 429 (rate limit)

4. **Monitoraggio**
   - Traccia l'uso dei token tramite `lastUsedAt`
   - Monitora i logs per attività sospette
   - Imposta scadenze appropriate

## Supporto

Per problemi o domande sull'API:
- Consulta la documentazione Swagger: `/api/v1/docs`
- Controlla gli activity logs: `GET /api/activity-logs`
- OpenAPI spec: `/api/v1/openapi.json`
