# AWS deployment

Target region **eu-west-2 (London)**. Nothing in this document has been provisioned or
deployed; these are the steps to build it, plus the constraints the application already
satisfies.

## Architecture

```
                Browser
                   |
                   v
        CloudFront distribution                (TLS, caching, security headers)
         |                      |
         v                      v
  S3 origin                Lambda Function URL / API Gateway
  (static assets)          (Node.js 22, arm64)
  _next/static/*           Server components, /api/v1/*, course pages
  fonts, brand assets, robots.txt
                                |
                                v
                    Approved catalogue release
                    (packaged in the deployment bundle,
                     or read from a private versioned S3 bucket)
```

Everything the service needs is in memory. A catalogue of 393 records does not justify a
database, and the reference engine holds no state between requests. Add a database only
when editable content workflow, saved results, or delivery and consent records are
switched on.

### Services used

| Service | Purpose |
| --- | --- |
| CloudFront | Single public entry point, TLS with an ACM certificate in `us-east-1`, response headers policy, caching |
| S3 | Immutable build assets under `_next/static/*`, self-hosted fonts, `robots.txt`. Private bucket reached through Origin Access Control |
| Lambda (arm64) | Server rendering, the recommendation API, health checks. Graviton is cheaper per millisecond and this workload is pure CPU |
| Amazon ECR | Only if the Lambda is deployed as a container image rather than a zip |
| CloudWatch | Redacted logs, alarms |
| Secrets Manager | Any secret the service later needs. Nothing today |

### Deliberately not used

ECS, Fargate, App Runner, RDS, Aurora, DSQL and Amplify are all excluded. The service is
stateless with a read-only in-memory dataset, so none of them is required, and each adds
standing cost and operational surface. This departs from handoff section 8, which
recommended ECS/Fargate; the departure is recorded as AR-009 in the ambiguity register.
The practical differences are that scaling is per request rather than per task, there is
no load balancer to pay for or patch, and cold starts replace always-warm containers.

App Runner is additionally unavailable: AWS stopped accepting new customers on
30 April 2026.

## Before deploying

Localhost validation must be complete first:

```sh
npm ci
npm run prepare:catalogue
npm test          # 34 reference-engine tests, 662 application tests
npm run build
npm run start     # exercise the full journey at http://localhost:3000
```

## Build

The application is a standard Next.js App Router build. For Lambda, use the standalone
output so the bundle carries only what it needs:

```js
// next.config.mjs
const nextConfig = {
  output: 'standalone',
  // The catalogue is read from disk at request time through a path built at runtime, so
  // Next's file tracing cannot infer it. Without this the standalone bundle ships with no
  // release at all, and every request answers 503 at /api/v1/health/ready.
  outputFileTracingIncludes: { '/**': ['./data/generated/**'] },
  /* ...existing config */
};
```

Confirm it travelled before deploying anything. `infra/scripts/package.sh` fails the build
if it did not:

```sh
ls .next/standalone/data/generated/release-manifest.json
```

Then:

```sh
npm ci
npm run prepare:catalogue          # writes data/generated/<releaseId>.json + manifest
npm run build
```

The published catalogue release must be inside the deployment bundle, or in a private
versioned S3 bucket the Lambda role can read. It must never be fetched from a public
URL, and the application must never unpack the source ZIP at runtime.

## Deploy

1. **Account and infrastructure as code.** Confirm the SLC-owned AWS account, billing
   owner, DNS and a production/staging split. Provision everything with CDK, Terraform or
   CloudFormation in `eu-west-2`. Do not click through the console.

   This is implemented in `infra/`, as AWS CDK in TypeScript. `infra/README.md` carries the
   deployment, release and rollback procedures. It is three stacks rather than one because
   CloudFront takes a certificate and a web ACL only from us-east-1, and publishes its
   metrics only into us-east-1, so the alarms that watch them must be created there too.

2. **Static assets.** Sync `.next/static` to `s3://<bucket>/_next/static/` and `public/`
   to the bucket root. Set `Cache-Control: public, max-age=31536000, immutable` on
   fingerprinted assets and on `/fonts/*` and `/brand/*`. Keep the bucket private and expose it only
   through CloudFront Origin Access Control.

3. **Lambda.** Publish the standalone server as a zip or an ECR image with
   `Architectures: ['arm64']` and a Node.js 22 runtime. Start at 1024 MB and tune from
   the observed duration. Set the concurrency reserve from expected peak traffic. The
   function needs `s3:GetObject` on the catalogue prefix only, and nothing else.

4. **CloudFront.** One distribution, two origins:
   - `/_next/static/*`, `/fonts/*`, `/brand/*` to the S3 origin, cached long.
   - `/robots.txt` stays on the Lambda origin. It is generated by `src/app/robots.ts`, not
     a file in `public/`, so routing it to S3 returns a 403 for a URL search engines read.
   - everything else to the Lambda origin.
   Forward no cookies. Attach a response headers policy carrying HSTS and the headers
   already set in `next.config.mjs`, and confirm the origin's `Cache-Control: no-store`
   on `/guide/*` and `/api/*` is honoured rather than overridden.

5. **Certificate and DNS.** ACM certificate in `us-east-1` for the CloudFront
   distribution. Point the approved hostname at it in Route 53 or the college's existing
   DNS. The website team confirms the canonical URL before launch.

6. **Configuration.** Set environment variables from `.env.example` as plain Lambda
   configuration, except secrets, which go in Secrets Manager and are referenced, never
   inlined. There are no secrets in the default configuration. `ALLOWED_COURSE_URL_HOSTS`
   must be set explicitly in production: the reference engine treats an absent host
   allowlist as reference evaluation only.

7. **Readiness.** Point a health check at `/api/v1/health/ready`. It returns 503 until a
   checksum-verified, unexpired catalogue release loads, so a bad release fails closed.

8. **Observability.** CloudWatch alarms on Lambda errors, p95 duration, throttles, 5xx at
   CloudFront, and catalogue age. A synthetic canary should walk homepage to result once
   a period. Logs must never contain answers, free text or contact details; the
   application does not log them.

## Releasing a new catalogue

Publication is a pointer change, not an edit:

1. Run `npm run prepare:catalogue` against the new source snapshot.
2. Review `quarantined` and `rejected` in the generated release before approving it.
3. Upload the new release file beside the existing ones.
4. Update `release-manifest.json` so `activeReleaseId` names it.
5. Verify `/api/v1/health/ready` reports the new release, then shift traffic.

**Rollback** points `activeReleaseId` back at a previously published, tested release
file. Reapply the emergency suppression list before readiness passes: a rollback must
never resurrect a withdrawn course.

Reapplying it is a gate, not a reminder. `scripts/publish-catalogue.mjs` writes
`emergencySuppressionList: []` into every new manifest, and `catalogueReady()` does not
inspect the list, so a publication or a rollback that drops it serves withdrawn courses
while `/api/v1/health/ready` still answers 200. `ops/suppression-list.json` is the durable
record and `infra/scripts/preflight.mjs` refuses to deploy until the manifest matches it.

## Cost shape

At low traffic this is a few pounds a month: CloudFront requests and transfer, S3 storage
measured in megabytes, and Lambda billed per millisecond on Graviton. There is no
always-on compute, no load balancer and no database. The dominant risk is cold starts on
a quiet service, which is a latency question rather than a cost one.

## Security

- No credentials in the repository, the image, the client bundle or plain configuration.
- The bucket is private; CloudFront reaches it through Origin Access Control.
- The Lambda role reads the catalogue prefix and nothing else.
- CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy: no-referrer` and
  `Permissions-Policy` are set by the application and should be reinforced at CloudFront.
- The CSP allows `'unsafe-eval'` under `next dev` only, because React's development build
  needs it to rebuild call stacks for its error overlay. `next build` and `next start` do
  not, so nothing deployed carries it. Confirm this after any deployment by checking that
  the `script-src` directive on a live response reads `'self' 'unsafe-inline'` and no more.
- Rate limit `/api/v1/recommendations` with AWS WAF. The application already caps request
  bodies at 64 KB and rejects unknown properties.
- Personalised routes send `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
- Enable dependency and secret scanning in CI. Lock exact versions at build time.
