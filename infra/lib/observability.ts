import { Duration, Stack, RemovalPolicy } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as synthetics from 'aws-cdk-lib/aws-synthetics';
import * as path from 'path';
import type { SlcConfig } from './config';

export interface AlarmProps {
  config: SlcConfig;
  server: lambda.Function;
}

/** A topic plus the action every alarm in this file uses. */
function notifier(stack: Stack, config: SlcConfig) {
  const topic = new sns.Topic(stack, 'Alarms', {
    displayName: `SLC Career & Course Finder (${config.stage})`
  });
  topic.addSubscription(new subscriptions.EmailSubscription(config.alarmEmail));
  return new actions.SnsAction(topic);
}

function alarmFactory(stack: Stack, notify: actions.SnsAction) {
  return (
    id: string,
    metric: cloudwatch.IMetric,
    threshold: number,
    evaluationPeriods: number,
    description: string,
    comparison: cloudwatch.ComparisonOperator = cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
  ) => {
    const a = new cloudwatch.Alarm(stack, id, {
      metric,
      threshold,
      evaluationPeriods,
      alarmDescription: description,
      comparisonOperator: comparison,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });
    a.addAlarmAction(notify);
    a.addOkAction(notify);
    return a;
  };
}

/**
 * Alarms for the server, plus the canary.
 *
 * The canary is the one that matters most. `/api/v1/health/ready` answers 503 whenever
 * the catalogue release cannot be checksum-verified or its reviews have expired, so a
 * single check covers a corrupt release file, a manifest pointing at nothing, and a
 * catalogue that has gone stale. That is the "catalogue age" alarm the runbook asks for:
 * the application already knows when its own data is out of date, so nothing here
 * re-implements that judgement.
 *
 * The CloudFront 5xx alarm is not here. CloudFront publishes its metrics only into
 * us-east-1, and an alarm has to be created in the region its metric lives in, so it
 * sits in SlcEdgeMonitoringStack instead.
 */
export function addApplicationAlarms(stack: Stack, props: AlarmProps): void {
  const { config, server } = props;
  const notify = notifier(stack, config);
  const alarm = alarmFactory(stack, notify);

  // --- the server ---

  alarm(
    'ServerErrors',
    server.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
    5, 1,
    'The server function is throwing. Check the log group before touching the catalogue.'
  );

  alarm(
    'ServerDurationP95',
    server.metricDuration({ period: Duration.minutes(5), statistic: 'p95' }),
    5_000, 3,
    'p95 duration above five seconds. Usually cold starts on a quiet service; if it is sustained, raise memory before raising the timeout.'
  );

  alarm(
    'ServerThrottles',
    server.metricThrottles({ period: Duration.minutes(5), statistic: 'Sum' }),
    0, 1,
    'Reserved concurrency is being hit. Learners are getting errors. Raise reservedConcurrency.'
  );

  // --- the canary ---

  const artifacts = new s3.Bucket(stack, 'CanaryArtifacts', {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    lifecycleRules: [{ expiration: Duration.days(30) }]
  });

  const canaryRole = new iam.Role(stack, 'CanaryRole', {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    inlinePolicies: {
      canary: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            actions: ['s3:PutObject', 's3:GetBucketLocation'],
            resources: [artifacts.arnForObjects('*'), artifacts.bucketArn]
          }),
          new iam.PolicyStatement({ actions: ['s3:ListAllMyBuckets'], resources: ['*'] }),
          new iam.PolicyStatement({
            actions: ['logs:CreateLogStream', 'logs:PutLogEvents', 'logs:CreateLogGroup'],
            resources: [`arn:aws:logs:${stack.region}:${stack.account}:log-group:/aws/lambda/cwsyn-*`]
          }),
          new iam.PolicyStatement({
            actions: ['cloudwatch:PutMetricData'],
            resources: ['*'],
            conditions: { StringEquals: { 'cloudwatch:namespace': 'CloudWatchSynthetics' } }
          })
        ]
      })
    }
  });

  const canary = new synthetics.Canary(stack, 'JourneyCanary', {
    // Runtime versions are retired on a schedule. Check the current one with:
    //   aws synthetics describe-runtime-versions --region eu-west-2
    runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_9_1,
    test: synthetics.Test.custom({
      code: synthetics.Code.fromAsset(path.join(__dirname, '..', 'canary')),
      handler: 'journey.handler'
    }),
    schedule: synthetics.Schedule.rate(Duration.minutes(15)),
    artifactsBucketLocation: { bucket: artifacts },
    role: canaryRole,
    environmentVariables: { SITE_URL: `https://${config.domainName}` },
    startAfterCreation: true
  });

  alarm(
    'CanaryFailing',
    canary.metricSuccessPercent({ period: Duration.minutes(30), statistic: 'Average' }),
    99, 1,
    'The homepage-to-results walk or the readiness check is failing. Readiness covers a corrupt release, a mispointed manifest and an expired catalogue.',
    cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD
  );
}
