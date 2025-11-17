# DNS Provider SDK Installation Guide

Some DNS providers require additional SDK packages to function. This guide explains which packages are optional and how to install them.

## Overview

The ACME Certificate Manager includes built-in support for multiple DNS providers. Some providers work out-of-the-box using native Node.js fetch API, while others require third-party SDKs to be installed separately.

### ✅ Built-in Providers (No Installation Required)

These providers work immediately without additional packages:

- **Manual** - Displays instructions for manual DNS record creation
- **Cloudflare** - Uses Cloudflare API v4 with native fetch
- **DigitalOcean** - Uses DigitalOcean API v2 with native fetch
- **GoDaddy** - Uses GoDaddy Domains API with native fetch
- **Namecheap** - Uses Namecheap Domains API with native fetch

### 🔧 Optional SDK-Based Providers

These providers require additional npm packages to be installed:

| Provider             | Package(s) Required                  | Status   |
| -------------------- | ------------------------------------ | -------- |
| **AWS Route53**      | `@aws-sdk/client-route53`            | Optional |
| **Google Cloud DNS** | `@google-cloud/dns`                  | Optional |
| **Azure DNS**        | `@azure/arm-dns` + `@azure/identity` | Optional |
| **OVH**              | `ovh`                                | Optional |

## Installation Instructions

### AWS Route53

To use AWS Route53 as a DNS provider:

```bash
cd backend
npm install @aws-sdk/client-route53
```

**Required Credentials:**
- `accessKeyId` - AWS Access Key ID
- `secretAccessKey` - AWS Secret Access Key
- `hostedZoneId` - Route53 Hosted Zone ID
- `region` - AWS Region (optional, default: us-east-1)

**Setup Guide:**
1. Create an IAM user with Route53 permissions
2. Generate access keys
3. Find your Hosted Zone ID in Route53 console
4. Add credentials when creating DNS provider in the app

### Google Cloud DNS

To use Google Cloud DNS:

```bash
cd backend
npm install @google-cloud/dns
```

**Required Credentials:**
- `projectId` - Google Cloud Project ID
- `keyFile` - Service Account JSON (as string)
- `managedZone` - Managed Zone name

**Setup Guide:**
1. Create a Service Account in Google Cloud Console
2. Grant "DNS Administrator" role
3. Generate and download JSON key file
4. Copy the entire JSON content as a string
5. Find your Managed Zone name in Cloud DNS
6. Add credentials when creating DNS provider in the app

### Azure DNS

To use Azure DNS:

```bash
cd backend
npm install @azure/arm-dns @azure/identity
```

**Required Credentials:**
- `subscriptionId` - Azure Subscription ID
- `resourceGroupName` - Resource Group name
- `zoneName` - DNS Zone name
- `tenantId` - Azure AD Tenant ID
- `clientId` - Service Principal Client ID
- `clientSecret` - Service Principal Secret

**Setup Guide:**
1. Register an application in Azure AD
2. Create a Service Principal
3. Grant "DNS Zone Contributor" role
4. Generate client secret
5. Collect all required IDs
6. Add credentials when creating DNS provider in the app

### OVH

To use OVH DNS:

```bash
cd backend
npm install ovh
```

**Required Credentials:**
- `endpoint` - OVH API endpoint (e.g., ovh-eu, ovh-ca, ovh-us)
- `applicationKey` - OVH Application Key
- `applicationSecret` - OVH Application Secret
- `consumerKey` - OVH Consumer Key
- `zoneName` - DNS Zone name

**Setup Guide:**
1. Create an OVH API application at https://api.ovh.com/createApp/
2. Generate consumer key with appropriate permissions
3. Select correct endpoint for your region
4. Add credentials when creating DNS provider in the app

## Installing All Optional SDKs

If you want to enable all DNS providers, you can install all optional packages at once:

```bash
cd backend
npm install @aws-sdk/client-route53 @google-cloud/dns @azure/arm-dns @azure/identity ovh
```

**Note:** This will increase your `node_modules` size significantly. Only install the SDKs you actually need.

## Verifying Installation

After installing SDK packages:

1. Restart the backend server
2. Go to **DNS Providers** in the application
3. Create a new DNS provider
4. Select the provider type you installed the SDK for
5. Enter credentials
6. Click **Test** to verify the connection

If the SDK is not installed, you'll see an error message indicating which package is required.

## Development vs Production

### Development

During development, you can install SDKs as needed:

```bash
npm install --save @aws-sdk/client-route53
```

### Production

For production deployments:

1. **Docker:** Add required SDKs to `package.json` before building the image
2. **Node.js:** Run `npm install` with the required packages in your production environment
3. **Environment Variables:** Store credentials securely using environment variables or secrets management

## Troubleshooting

### "Module not found" error

If you see an error like:

```
AWS Route53 provider requires @aws-sdk/client-route53.
Install with: npm install @aws-sdk/client-route53
```

This means the SDK is not installed. Follow the installation instructions above.

### SDK installed but still getting errors

1. Verify the package is in `backend/package.json` dependencies
2. Check `backend/node_modules` contains the package
3. Restart the backend server completely
4. Clear Node.js cache: `npm cache clean --force`

### Permission errors with cloud providers

Each cloud provider requires specific permissions:

- **AWS:** Route53 full access or specific zone permissions
- **Google Cloud:** DNS Administrator role
- **Azure:** DNS Zone Contributor role
- **OVH:** Domain DNS management permissions

Check your IAM/service account permissions if validation fails.

## Custom Providers

If you're developing a custom DNS provider that requires an SDK:

1. Add the SDK to `backend/package.json` as a dependency
2. Import and use the SDK in your provider class
3. Add installation instructions to your provider documentation
4. Consider making the SDK optional with graceful error handling

Example:

```typescript
async createTxtRecord(...) {
    try {
        const CustomSDK = require('custom-dns-sdk');
        // Use SDK
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            throw new Error(
                'Custom DNS provider requires custom-dns-sdk package. ' +
                'Install with: npm install custom-dns-sdk'
            );
        }
        throw error;
    }
}
```

## Support

For provider-specific issues:

- **AWS Route53:** https://docs.aws.amazon.com/route53/
- **Google Cloud DNS:** https://cloud.google.com/dns/docs
- **Azure DNS:** https://learn.microsoft.com/en-us/azure/dns/
- **OVH:** https://docs.ovh.com/

For application issues, refer to the main project documentation or create an issue in the repository.

---

**Last Updated:** October 2024  
**Version:** 1.0
