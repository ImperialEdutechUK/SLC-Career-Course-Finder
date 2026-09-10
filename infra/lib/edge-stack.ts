import { Stack, StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import type { SlcConfig } from './config';

/**
 * Everything CloudFront requires in us-east-1, whatever region the application runs in:
 * the TLS certificate and the web ACL. Both are global-scope resources that CloudFront
 * will only accept from that region, which is why they are not in the application stack.
 */
export class SlcEdgeStack extends Stack {
  /** Undefined when serving on CloudFront's own domain, which needs no certificate. */
  readonly certificate?: acm.ICertificate;
  readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: StackProps & { config: SlcConfig }) {
    super(scope, id, props);
    const { config } = props;

    this.certificate = !config.domainName
      ? undefined
      : config.hostedZoneId
      ? new acm.Certificate(this, 'Certificate', {
          domainName: config.domainName,
          // DNS validation renews without anyone touching it. Email validation does not.
          validation: acm.CertificateValidation.fromDns(
            route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
              hostedZoneId: config.hostedZoneId,
              zoneName: config.domainName.split('.').slice(-2).join('.')
            })
          )
        })
      : new acm.Certificate(this, 'Certificate', {
          domainName: config.domainName,
          // The college's DNS is not in this account, so the CNAME that proves ownership
          // has to be added by whoever runs it. The stack waits until that happens.
          validation: acm.CertificateValidation.fromDns()
        });

    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `slc-${config.stage}-web-acl`,
        sampledRequestsEnabled: true
      },
      // CloudFormation's pattern for this field rejects an ampersand.
      description: 'South London College Career and Course Finder',
      rules: [
        {
          // The brief asks for a rate limit on the recommendation endpoint specifically.
          // It is the only route that runs the engine, and the only one worth abusing.
          // Everything else stays unthrottled so a shared college or library address
          // cannot lock learners out of simply reading the catalogue.
          name: 'RateLimitRecommendations',
          priority: 0,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 300,
              evaluationWindowSec: 300,
              aggregateKeyType: 'IP',
              scopeDownStatement: {
                byteMatchStatement: {
                  fieldToMatch: { uriPath: {} },
                  positionalConstraint: 'EXACTLY',
                  searchString: '/api/v1/recommendations',
                  textTransformations: [{ priority: 0, type: 'LOWERCASE' }]
                }
              }
            }
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `slc-${config.stage}-rate-limit-recommendations`,
            sampledRequestsEnabled: true
          }
        },
        {
          // A far looser ceiling across everything else, to absorb a crawler or a script
          // without ever being reachable by a real learner.
          name: 'RateLimitAll',
          priority: 1,
          action: { block: {} },
          statement: {
            rateBasedStatement: { limit: 3000, evaluationWindowSec: 300, aggregateKeyType: 'IP' }
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `slc-${config.stage}-rate-limit-all`,
            sampledRequestsEnabled: true
          }
        },
        {
          // Managed rules run in count mode first. Turning them straight to block on a
          // service nobody has load-tested is how you discover a false positive from a
          // learner rather than from a dashboard. Flip to none: {} after reviewing the
          // sampled requests.
          name: 'AWSManagedCommon',
          priority: 2,
          overrideAction: { count: {} },
          statement: {
            managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesCommonRuleSet' }
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `slc-${config.stage}-managed-common`,
            sampledRequestsEnabled: true
          }
        }
      ]
    });

    this.webAclArn = webAcl.attrArn;

    // Full WAF request logging is deliberately not enabled. It would need a Firehose
    // delivery stream, which is outside the agreed service list, and its records carry
    // the request path of every learner. CloudWatch metrics and WAF's own sampled
    // requests give enough to tune the rules without keeping a browsing record.
  }
}
