# Infrastructure

Deploys the Career & Course Finder to AWS in eu-west-2, following
`docs/AWS-DEPLOYMENT.md`.

```
Browser -> CloudFront -> S3            (static assets, Origin Access Control)
                      -> Lambda arm64  (server, API, Function URL, Origin Access Control)
```

Nothing here has been provisioned. These stacks synthesize and have been checked against
the generated CloudFormation, but no AWS account has been touched.

## Why CDK

CDK in TypeScript, synthesizing to CloudFormation, which `docs/AWS-DEPLOYMENT.md` already
sanctions.

- The repository is already TypeScript under a strict compiler. No second language and no
  extra binary for whoever inherits this.
- The parts most easily got wrong by hand are Origin Access Control, the response headers
  policy and the IAM around a private Function URL. CDK's L2 constructs generate those,
  and `cdk diff` is the plan step the brief asks for.
- CloudFormation holds the state in the account, so there is no state bucket or lock table
  to own and no way for two people to corrupt a state file.

Terraform would be the better call if this had to sit alongside non-AWS infrastructure or
if the team already ran it. Neither is true here.

The stacks are in their own package with their own `package.json`, so CDK cannot reach the
application's dependency tree, the Lambda bundle or the browser.

## What gets created

Three stacks, because CloudFront forces the split.

| Stack | Region | Contains |
| --- | --- | --- |
| `Slc-<stage>-Edge` | us-east-1 | ACM certificate, WAF web ACL |
| `Slc-<stage>-App` | eu-west-2 | S3 bucket, Lambda, Function URL, CloudFront, server alarms, canary |
| `Slc-<stage>-EdgeMonitoring` | us-east-1 | CloudFront 4xx and 5xx alarms |

CloudFront accepts a certificate and a web ACL only from us-east-1, and publishes its
metrics only into us-east-1, and CloudWatch will not let an alarm watch a metric from
another region. That is the whole reason for the first and third stacks.

Services used: CloudFront, S3, Lambda, CloudWatch, SNS, WAF, ACM, Route 53 alias record
when the zone is in the account. No ECR: the bundle is 21 MB zipped, well inside the
250 MB unzipped limit, so it ships as a zip and no container is needed. No ECS, Fargate,
App Runner, RDS, Aurora, DSQL or Amplify.

Secrets Manager is wired for nothing, because the service has no secret. When one is
added, put it in Secrets Manager and grant the function's role read on that ARN only.
Never inline it into `environment`, which is readable by anyone with
`lambda:GetFunctionConfiguration`.

## Prerequisites

1. **The account.** SLC-owned, with a staging and production split. Never deploy both
   stages into one account.
2. **Bootstrap**, once per account and region:
   ```sh
   npx cdk bootstrap aws://<account>/eu-west-2 aws://<account>/us-east-1
   ```
3. **The Lambda Web Adapter layer version.** It is required rather than defaulted,
   because a stale hard-coded version deploys cleanly and then fails on the first request:
   ```sh
   aws lambda list-layer-versions \
     --layer-name LambdaAdapterLayerArm64 --owner 753240598075 \
     --region eu-west-2 --query 'LayerVersions[0].LayerVersionArn' --output text
   ```
4. **Context.** Copy `cdk.context.example.json` to `cdk.context.json` and fill it in.
   `cdk.context.json` is not committed.
5. **The hostname**, confirmed by the college's website team. If the DNS zone is not in
   this account, leave `hostedZoneId` out: the certificate then waits for a validation
   CNAME that whoever runs the DNS has to add, and the stack outputs the CloudFront
   hostname to point at.

## Deploying

```sh
# 1. The application must be green first.
npm ci
npm test                              # 34 reference-engine + 662 application tests
node infra/scripts/preflight.mjs      # checksum, review expiry, suppression list

# 2. Build the Lambda bundle.
bash infra/scripts/package.sh

# 3. Look at the plan. Nothing is created by this.
cd infra && npm ci && npm run diff

# 4. Deploy, in dependency order. CDK works this out itself.
npm run deploy
```

Deploy the edge stack first if you are doing it by hand: the certificate has to exist,
and be validated, before CloudFront will take it. `cdk deploy --all` handles the ordering.

### After the first deploy

```sh
curl -s https://<hostname>/api/v1/health/ready          # must be 200 and "ready"
curl -sI https://<hostname>/ | grep -i strict-transport # HSTS from CloudFront
curl -sI https://<hostname>/ | grep -i content-security # 'self' 'unsafe-inline', no more
curl -sI https://<hostname>/guide/career | grep -i cache-control  # no-store
```

The CSP check matters. `'unsafe-eval'` is allowed under `next dev` only. If it appears on
a deployed response, something is serving a development build.

## Releasing a new catalogue

Publication is a pointer change, not an edit. The application never reads the staging
snapshot, and `data/source/` is never modified.

1. `npm run prepare:catalogue` against the new source snapshot.
2. Review `quarantined` and `rejected` in the generated release before approving it.
3. **Reapply the emergency suppression list.** `scripts/publish-catalogue.mjs` writes
   `emergencySuppressionList: []` into every new manifest, so each publication drops it.
   Copy the ids from `ops/suppression-list.json` into `emergencySuppressionList` in
   `data/generated/release-manifest.json`.
4. `node infra/scripts/preflight.mjs`. This refuses to proceed if the checksum does not
   match, if the reviews have expired or expire within thirty days, or if step 3 was
   missed. It exits non-zero, so CI can gate on it.
5. `bash infra/scripts/package.sh && cd infra && npm run deploy`.
6. Confirm `/api/v1/health/ready` names the new release before announcing it:
   ```sh
   curl -s https://<hostname>/api/v1/health/ready
   ```

### Why step 3 needs a gate rather than a note

The application applies the manifest's suppression list at serve time, in
`approvedCourses()` and `displayRecords()`. It does not apply
`ops/suppression-list.json`, and `catalogueReady()` does not inspect either. So a
republication that drops the list puts every withdrawn course back in front of learners
while `/api/v1/health/ready` still answers 200 "ready". No health check will catch it.
`ops/suppression-list.json` is the durable record and the preflight is the gate. Add an id
there first, then to the manifest.

## Rolling back

**A bad catalogue, good code.** Point the manifest back at a release file that was
previously published and tested, reapply the suppression list, and redeploy:

```sh
# in data/generated/release-manifest.json set activeReleaseId, activeReleaseFile and
# checksum back to the known-good release, and restore emergencySuppressionList
node infra/scripts/preflight.mjs      # will not pass until the list is reapplied
bash infra/scripts/package.sh
cd infra && npm run deploy
```

A rollback must never resurrect a withdrawn course. That is exactly the case the preflight
exists for: the older manifest you are rolling back to carries the suppression list as it
was on that day, which may be shorter than today's.

**Bad code.** Roll the stack back to the previous CloudFormation state:

```sh
aws cloudformation cancel-update-stack --stack-name Slc-production-App --region eu-west-2
# or redeploy the previous commit
git checkout <previous-tag> && bash infra/scripts/package.sh && cd infra && npm run deploy
```

Static assets are fingerprinted and the bucket is versioned, so an older page keeps
finding the assets it was built against. Do not empty the bucket as part of a rollback.

**The fastest mitigation** is not a rollback. If a single course must stop being served
right now, add its canonical id to `ops/suppression-list.json` and to the manifest, then
redeploy. That path changes no course data and no code.

## What the alarms mean

| Alarm | Means | First move |
| --- | --- | --- |
| `CanaryFailing` | Readiness is 503, or the questionnaire stopped rendering | `curl /api/v1/health/ready`. `release_reviews_expired` means republish; `CatalogueUnavailableError` means the checksum or the pointer is wrong |
| `ServerErrors` | The function is throwing | Its log group. Answers and free text are never logged, so the logs are safe to read and share |
| `ServerThrottles` | Reserved concurrency reached; learners are seeing errors | Raise `reservedConcurrency` |
| `ServerDurationP95` | Slow | Usually cold starts on a quiet service. Raise memory before timeout |
| `EdgeServerErrorRate` | 5xx at the edge | Check the server first; if it is healthy, suspect Origin Access Control |
| `EdgeClientErrorRate` | Sustained 4xx | Usually links to courses a release has withdrawn |

Readiness is the alarm that covers catalogue age. `catalogueReady()` returns false once
`reviewValidUntil` passes, so a stale catalogue fails closed and the canary reports it.

## Known gaps

- **The Lambda Web Adapter layer version is not pinned in code.** It cannot be looked up
  at synth time. Record the version you deployed alongside the release.
- **The Synthetics runtime is pinned to `syn-nodejs-puppeteer-9.1`.** AWS retires these on
  a schedule. Check with `aws synthetics describe-runtime-versions --region eu-west-2`.
- **WAF managed rules run in count mode.** Review the sampled requests, then change
  `overrideAction` from `count` to `none` in `lib/edge-stack.ts`. Blocking on a service
  nobody has load-tested risks finding a false positive through a learner.
- **No WAF request logging.** It needs a Firehose delivery stream, which is outside the
  agreed service list, and its records carry the request path of every learner. Metrics
  and sampled requests are enough to tune the rules.
- **Nothing has been deployed.** Rate limits, memory and reserved concurrency are starting
  points chosen from the shape of the workload, not from measurement. Revisit all three
  after the first week of real traffic.
