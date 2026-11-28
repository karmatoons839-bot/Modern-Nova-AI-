# Modern Nova Hosting integration

The interface, ADMIN/OWNER records and hosting plan CRUD are local. Actual hosting is **not connected** until an isolated provisioning service is configured. No live environments were created. OWNER alone can save the public HTTPS service hostname and token in Connection. Tokens are AES-GCM encrypted using a server-only key and never returned through the Data API or overview. Saving configuration is not deployment success.

## Service contract

Set server-only `HOSTING_API_URL` (HTTPS, no embedded credentials) and `HOSTING_API_TOKEN` through secure project configuration. Never use browser-visible variables. The service must implement:

- `GET /v1/metrics`: actual numeric `cpu_percent`, `ram_percent`, `disk_percent`, `storage_bytes`, `bandwidth_bytes`, `uptime_seconds`, `server_status`, `location`. Missing measurements display Unavailable.
- `GET /v1/inventory`: `{ resources: [{provider_id, kind, name, status, details}] }`. Supported kinds: website, domain, database, backup, server, ftp, cron, deployment, security. Safe details include domain, runtime, ssl_status, dns_verified, size_bytes, host, port, location, created_at, plan_name. Omit credentials.
- `POST /v1/actions`: `{operation_id, action, resource_id, fields}`. The service must atomically deduplicate operation IDs, isolate each website's filesystem/database/OS identity and verify DNS before connected status. It must implement the allowlisted operations in `src/lib/hosting.ts` or reject them with a clear non-success response.
- Confirm only finished actions with `{status: 'completed'}`. Domain connection actions return `dns_records: [{type,name,value}]` for the externally purchased domain; verification must inspect real DNS, and never connect or issue SSL prematurely. `website.publish` requires a selected website, verified DNS and SSL, and returns the actual HTTPS `live_url`. File browsing can add `files: [{name,path,size,directory}]`, file reads add bounded `text`, downloads add a short-lived HTTPS `download_url`. Do not return credentials. Ambiguous outcomes remain review-required and are never automatically replayed. Domain purchasing/selling is not supported.

## Required infrastructure behavior

HTML, PHP, Node.js, WordPress and custom apps need real runtime environments; MySQL databases/users/backups need service-managed isolation. FTP, SSH, Git, cron and environment changes must be finite authorized operations, not unrestricted commands on the management application's host. Backups/restores require encryption, integrity checks and explicit destructive-action confirmation. Scheduled backups must be run by the provisioning service. Provider inventory is refreshed explicitly and upserted without fabricating rows; deletion reconciliation and website-to-resource association require provider commissioning before production use.

Large file transfers above 1 MB require provider FTP or a separately commissioned signed-upload flow. No SSH credentials, environment values or passwords are persisted or returned by this application. The service and deployment destination are not supplied; real provisioning, DNS, MySQL, SSL, restore and telemetry acceptance remain blocked.

## Reported TypeScript error

`src/pages/NotFound.tsx` is absent; the actual not-found page is in `src/routes/__root.tsx` and requires no `handleClose` prop. Do not create an unsupported `src/pages` hierarchy to mask an error from another source tree. The original offending component/callsite is required to resolve that specific TS2741 report.