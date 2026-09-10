import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';
import type { SlcConfig } from './config';
import { addApplicationAlarms } from './observability';

export interface SlcAppStackProps extends StackProps {
  config: SlcConfig;
  certificate?: acm.ICertificate;
  webAclArn: string;
}

/** Where `npm run build` leaves the standalone server, relative to this file. */
const REPO_ROOT = path.join(__dirname, '..', '..');
const STANDALONE_DIR = path.join(REPO_ROOT, '.next', 'standalone');
const STATIC_DIR = path.join(REPO_ROOT, '.next', 'static');
const PUBLIC_DIR = path.join(REPO_ROOT, 'public');

export class SlcAppStack extends Stack {
  /** Read by the us-east-1 monitoring stack, which is where CloudFront metrics live. */
  readonly distributionId: string;

  constructor(scope: Construct, id: string, props: SlcAppStackProps) {
    super(scope, id, props);
    const { config, certificate, webAclArn } = props;

    // ---------------------------------------------------------------- static assets

    const assetBucket = new s3.Bucket(this, 'AssetBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Versioning is what makes a static rollback possible without a rebuild.
      versioned: true,
      removalPolicy: config.stage === 'production' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: config.stage !== 'production',
      lifecycleRules: [{ noncurrentVersionExpiration: Duration.days(90) }]
    });

    // ---------------------------------------------------------------------- server

    const serverLogs = new logs.LogGroup(this, 'ServerLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const server = new lambda.Function(this, 'Server', {
      // Graviton: cheaper per millisecond, and this workload is pure CPU.
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_22_X,
      // The Lambda Web Adapter turns the Function URL event into an ordinary HTTP
      // request, so the Next.js standalone server runs unmodified. `run.sh` is the
      // adapter's entry point and simply starts `node server.js`.
      handler: 'run.sh',
      code: lambda.Code.fromAsset(STANDALONE_DIR),
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(this, 'WebAdapter', config.lambdaAdapterLayerArn)
      ],
      memorySize: 1024,
      timeout: Duration.seconds(30),
      // Omitted entirely when 0: reserving nothing is not the same as reserving zero,
      // which would stop the function being invoked at all.
      ...(config.reservedConcurrency > 0
        ? { reservedConcurrentExecutions: config.reservedConcurrency }
        : {}),
      logGroup: serverLogs,
      environment: {
        // --- Lambda Web Adapter ---
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/bootstrap',
        AWS_LWA_PORT: '3000',
        PORT: '3000',
        // Liveness, not readiness, on purpose. Readiness answers 503 when the catalogue
        // release is bad or expired, and gating the adapter on it would turn a clean 503
        // into a cold-start failure. Traffic is gated on readiness by the deployment
        // procedure and watched by the canary instead. See infra/README.md.
        AWS_LWA_READINESS_CHECK_PATH: '/api/v1/health/live',
        AWS_LWA_ASYNC_INIT: 'true',

        // --- application ---
        NODE_ENV: 'production',
        HOSTNAME: '0.0.0.0',
        // PUBLIC_BASE_URL is deliberately absent. The application never reads it, and on
        // CloudFront's own domain the value is not known until after the distribution
        // exists, which the server function cannot depend on without a cycle.
        SLC_COURSE_ORIGIN: config.slcCourseOrigin,
        QUESTIONNAIRE_VERSION: config.questionnaireVersion,
        // The engine treats an absent allowlist as reference evaluation only, so this is
        // always set explicitly rather than left to a default.
        ALLOWED_COURSE_URL_HOSTS: config.allowedCourseUrlHosts,

        // Every optional branch and integration stays off until reviewed content and a
        // privacy owner exist. See docs/AMBIGUITY-REGISTER.md AR-007 and AR-010.
        CAREER_C7_ENABLED: 'false',
        COURSE_F6_ENABLED: 'false',
        SESSION_RESTORE_ENABLED: 'false',
        SAVED_RESULTS_ENABLED: 'false',
        CONTACT_REQUESTS_ENABLED: 'false',
        MARKETING_OPT_IN_ENABLED: 'false',
        NONESSENTIAL_ANALYTICS_ENABLED: 'false',
        AI_EXPLANATIONS_ENABLED: 'false'
      }
    });

    // The catalogue release travels inside the bundle, so the function needs no S3 read
    // and is given none. If a future release moves the catalogue to a private bucket,
    // grant s3:GetObject on that prefix here and nothing wider.
    const serverUrl = server.addFunctionUrl({
      // Never public. Only CloudFront, through Origin Access Control, may sign a request.
      authType: lambda.FunctionUrlAuthType.AWS_IAM
    });

    // ------------------------------------------------------------------- CloudFront

    // The application already sets CSP, X-Frame-Options and the rest. CloudFront adds
    // HSTS, which only the edge can meaningfully assert, and reinforces the others.
    const responseHeaders = new cloudfront.ResponseHeadersPolicy(this, 'ResponseHeaders', {
      comment: 'SLC Career & Course Finder',
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(730),
          includeSubdomains: true,
          preload: true,
          override: true
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER,
          override: true
        },
        // `override: false` so the application's own Content-Security-Policy wins. The
        // policy lives with the code that has to satisfy it, not at the edge.
        contentSecurityPolicy: {
          contentSecurityPolicy: "default-src 'self'",
          override: false
        }
      },
      removeHeaders: ['server', 'x-powered-by']
    });

    // Origin Access Control signs each request to the function URL with SigV4, and that
    // signature travels in the Authorization header. The managed AllViewerExceptHostHeader
    // policy forwards the viewer's own Authorization header, which displaces the
    // signature and makes the function URL answer 403 to everything. This forwards
    // everything except Host and Authorization instead. Cookies are excluded because the
    // service sets none and reads none.
    const serverOriginRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'ServerOriginRequest', {
      comment: 'SLC server origin: all viewer headers except Host and Authorization',
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.denyList('host', 'authorization'),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none()
    });

    /* Next.js serves two different bodies at the same URL. A browser navigating
       normally gets HTML; the same URL fetched during a client-side navigation
       carries an RSC header and returns a React Server Components payload
       instead. The application marks this with `Vary: RSC, Next-Router-...`,
       but CloudFront does not vary its cache on arbitrary headers, so with the
       managed CachingOptimized policy both variants share one cache key.

       Whichever variant is requested first is then served to everyone: a
       document request can receive raw RSC payload text, and a client
       navigation can receive HTML it cannot parse. The fix is to put those
       headers in the cache key so each variant is cached separately. */
    const serverCachePolicy = new cloudfront.CachePolicy(this, 'ServerCache', {
      comment: 'SLC server: RSC-aware cache key',
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'RSC',
        'Next-Router-State-Tree',
        'Next-Router-Prefetch',
        'Next-Router-Segment-Prefetch',
        'Next-Url'
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
      defaultTtl: Duration.minutes(5),
      minTtl: Duration.seconds(0),
      maxTtl: Duration.days(365)
    });

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(assetBucket);
    const serverOrigin = origins.FunctionUrlOrigin.withOriginAccessControl(serverUrl);

    // Long-lived, fingerprinted assets. Safe to cache hard because the name changes
    // whenever the bytes do.
    const immutable: cloudfront.BehaviorOptions = {
      origin: s3Origin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      responseHeadersPolicy: responseHeaders,
      compress: true
    };

    // The server. CACHING_OPTIMIZED honours the origin's own Cache-Control, which is how
    // `no-store` on /guide/* and /api/* survives the edge rather than being overridden.
    const dynamic: cloudfront.BehaviorOptions = {
      origin: serverOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: serverCachePolicy,
      originRequestPolicy: serverOriginRequestPolicy,
      responseHeadersPolicy: responseHeaders,
      compress: true
    };

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `SLC Career & Course Finder (${config.stage})`,
      defaultBehavior: dynamic,
      additionalBehaviors: {
        '/_next/static/*': immutable,
        '/fonts/*': immutable,
        '/brand/*': immutable,
        // Personalised journeys and the API must never be cached, whatever a future
        // change to the default behaviour does.
        '/guide/*': {
          ...dynamic,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED
        },
        '/api/*': {
          ...dynamic,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED
        }
      },
      // No alias and no certificate when serving on CloudFront's own domain.
      ...(config.domainName && certificate
        ? { domainNames: [config.domainName], certificate }
        : {}),
      webAclId: webAclArn,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // A TLS policy can only be chosen alongside a custom certificate. On CloudFront's
      // own domain the policy is fixed at TLSv1 and setting this would be ignored, so it
      // is applied only when there is a certificate to apply it to. Attaching the real
      // hostname is therefore also a TLS improvement, not just a cosmetic one.
      ...(config.domainName && certificate
        ? { minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021 }
        : {}),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enableLogging: false
      // No custom error responses. Missing pages already reach Lambda and render the
      // application's own not-found page with a 404. The only thing that produces a bare
      // 403 here is a missing object in S3 or a failure to sign an origin request, and
      // rewriting those to 404 would hide a broken deployment behind a tidy page.
    });

    // CDK's withOriginAccessControl grants only lambda:InvokeFunctionUrl. AWS also
    // requires lambda:InvokeFunction for a function URL behind Origin Access Control,
    // and without it every request through CloudFront answers 403 AccessDeniedException
    // while the function itself works perfectly when invoked directly. This is the
    // second statement in AWS's own documented pair.
    server.addPermission('CloudFrontInvokeFunction', {
      principal: new iam.ServicePrincipal('cloudfront.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`
    });

    // ------------------------------------------------------------------- asset sync

    // `public/` at the root. Fonts and the shield are fingerprint-free but effectively
    // immutable, and the deployment runbook replaces them by name when they change.
    new s3deploy.BucketDeployment(this, 'DeployPublic', {
      sources: [s3deploy.Source.asset(PUBLIC_DIR)],
      destinationBucket: assetBucket,
      cacheControl: [s3deploy.CacheControl.fromString('public, max-age=31536000, immutable')],
      // Two deployments share this bucket, so neither may prune the other's objects.
      prune: false
    });

    new s3deploy.BucketDeployment(this, 'DeployNextStatic', {
      sources: [s3deploy.Source.asset(STATIC_DIR)],
      destinationBucket: assetBucket,
      destinationKeyPrefix: '_next/static',
      cacheControl: [s3deploy.CacheControl.fromString('public, max-age=31536000, immutable')],
      prune: false
    });

    // ------------------------------------------------------------------------- DNS

    if (config.domainName && config.hostedZoneId) {
      const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
        hostedZoneId: config.hostedZoneId,
        zoneName: config.domainName.split('.').slice(-2).join('.')
      });
      new route53.ARecord(this, 'AliasRecord', {
        zone,
        recordName: config.domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution))
      });
    }

    // --------------------------------------------------------------- observability

    const siteUrl = config.domainName
      ? `https://${config.domainName}`
      : `https://${distribution.distributionDomainName}`;

    addApplicationAlarms(this, { config, server, siteUrl });

    // ----------------------------------------------------------------------- output

    this.distributionId = distribution.distributionId;

    new CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'SiteUrl', { value: siteUrl });
    new CfnOutput(this, 'ReadinessUrl', { value: `${siteUrl}/api/v1/health/ready` });
    new CfnOutput(this, 'AssetBucketName', { value: assetBucket.bucketName });
    new CfnOutput(this, 'ServerFunctionName', { value: server.functionName });
    if (config.domainName && !config.hostedZoneId) {
      new CfnOutput(this, 'DnsAction', {
        value: `Point ${config.domainName} at ${distribution.distributionDomainName} (CNAME) in the college's DNS.`
      });
    }
  }
}
