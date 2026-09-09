/**
 * Deployment configuration.
 *
 * Everything here is read from CDK context (`cdk.json`, `cdk.context.json` or
 * `-c key=value`) so no environment detail is committed. There are no secrets: the
 * application has none today, and anything added later belongs in Secrets Manager and is
 * referenced by ARN, never inlined.
 */
import type { Construct } from 'constructs';

export interface SlcConfig {
  /** AWS account to deploy into. Must be the SLC-owned account. */
  account: string;
  /** Where the application runs. The brief specifies London. */
  region: string;
  /** Public hostname the college has approved, e.g. `find.southlondoncollege.org`. */
  domainName: string;
  /**
   * Route 53 public hosted zone id for `domainName`. Omit when the college's DNS is
   * elsewhere: the certificate then needs its validation records adding by hand, and the
   * CNAME to the distribution is created by whoever runs that DNS.
   */
  hostedZoneId?: string;
  /** Which deployment this is. Staging and production never share a stack. */
  stage: 'staging' | 'production';
  /** Address that receives alarm notifications. */
  alarmEmail: string;
  /**
   * AWS Lambda Web Adapter layer, arm64, in `region`. It lets the Next.js standalone
   * server run behind a Function URL unmodified. Look the current version up with:
   *
   *   aws lambda list-layer-versions \
   *     --layer-name LambdaAdapterLayerArm64 --owner 753240598075 \
   *     --region eu-west-2 --query 'LayerVersions[0].LayerVersionArn' --output text
   *
   * It is required rather than defaulted on purpose. A stale hard-coded version is the
   * kind of thing that deploys cleanly and then fails at the first request.
   */
  lambdaAdapterLayerArn: string;
  /**
   * Hostnames the reference engine may serve course links for. The engine treats an
   * absent allowlist as reference evaluation only, so production must set this.
   */
  allowedCourseUrlHosts: string;
  /** Where course links point. */
  slcCourseOrigin: string;
  /** The only questionnaire content version the API accepts. */
  questionnaireVersion: string;
  /** Reserved concurrency for the server function. Set from expected peak. */
  reservedConcurrency: number;
}

const REQUIRED: (keyof SlcConfig)[] = [
  'account', 'domainName', 'alarmEmail', 'lambdaAdapterLayerArn'
];

export function readConfig(scope: Construct): SlcConfig {
  // A context file gives an object; `-c slc='{...}'` on the command line gives the
  // string it was typed as. Accept either, so the same key works both ways.
  const context = scope.node.tryGetContext('slc');
  let raw: Partial<SlcConfig> = {};
  if (typeof context === 'string') {
    try {
      raw = JSON.parse(context) as Partial<SlcConfig>;
    } catch {
      throw new Error("Context key \"slc\" was a string but not valid JSON.");
    }
  } else if (context && typeof context === 'object') {
    raw = context as Partial<SlcConfig>;
  }

  const config: SlcConfig = {
    account: raw.account ?? '',
    region: raw.region ?? 'eu-west-2',
    domainName: raw.domainName ?? '',
    hostedZoneId: raw.hostedZoneId,
    stage: raw.stage ?? 'staging',
    alarmEmail: raw.alarmEmail ?? '',
    lambdaAdapterLayerArn: raw.lambdaAdapterLayerArn ?? '',
    allowedCourseUrlHosts: raw.allowedCourseUrlHosts ?? 'southlondoncollege.org',
    slcCourseOrigin: raw.slcCourseOrigin ?? 'https://southlondoncollege.org',
    questionnaireVersion: raw.questionnaireVersion ?? '2026-09-08.1',
    reservedConcurrency: raw.reservedConcurrency ?? 50
  };

  const missing = REQUIRED.filter(key => !config[key]);
  if (missing.length) {
    throw new Error(
      `Missing required context under "slc": ${missing.join(', ')}.\n` +
      'Copy infra/cdk.context.example.json to cdk.context.json and fill it in, or pass ' +
      "-c slc='{\"account\":\"...\"}'. See infra/README.md."
    );
  }

  if (config.stage === 'production' && !config.allowedCourseUrlHosts) {
    throw new Error(
      'allowedCourseUrlHosts must be set explicitly in production. The reference engine ' +
      'treats an absent host allowlist as reference evaluation only.'
    );
  }

  return config;
}
