import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import type { SlcConfig } from './config';

export interface SlcEdgeMonitoringStackProps extends StackProps {
  config: SlcConfig;
  distributionId: string;
}

/**
 * The CloudFront alarms, in us-east-1 because that is the only region CloudFront
 * publishes distribution metrics into, and CloudWatch will not let an alarm watch a
 * metric from somewhere else.
 *
 * This is why it is a third stack rather than a few more lines in the application stack.
 * It is created after the distribution exists and reads its id across regions, so it
 * deploys last and can be rolled back on its own without touching serving traffic.
 */
export class SlcEdgeMonitoringStack extends Stack {
  constructor(scope: Construct, id: string, props: SlcEdgeMonitoringStackProps) {
    super(scope, id, props);
    const { config, distributionId } = props;

    const topic = new sns.Topic(this, 'EdgeAlarms', {
      displayName: `SLC Career & Course Finder edge (${config.stage})`
    });
    topic.addSubscription(new subscriptions.EmailSubscription(config.alarmEmail));
    const notify = new actions.SnsAction(topic);

    const metric = (metricName: string, statistic: string) =>
      new cloudwatch.Metric({
        namespace: 'AWS/CloudFront',
        metricName,
        dimensionsMap: { DistributionId: distributionId, Region: 'Global' },
        statistic,
        period: Duration.minutes(5)
      });

    const serverErrors = new cloudwatch.Alarm(this, 'EdgeServerErrorRate', {
      metric: metric('5xxErrorRate', 'Average'),
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription:
        'More than one percent of responses are 5xx at the edge. Check the server log group and readiness before republishing anything.',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });
    serverErrors.addAlarmAction(notify);
    serverErrors.addOkAction(notify);

    // 4xx is a softer signal: a crawler chasing withdrawn courses will raise it. It is
    // worth knowing about, but at a threshold that a little ordinary noise will not trip.
    const clientErrors = new cloudwatch.Alarm(this, 'EdgeClientErrorRate', {
      metric: metric('4xxErrorRate', 'Average'),
      threshold: 15,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription:
        'Sustained 4xx at the edge. Usually links to courses that a release has withdrawn.',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    });
    clientErrors.addAlarmAction(notify);
  }
}
