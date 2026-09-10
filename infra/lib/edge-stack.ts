import { Stack, StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import type { SlcConfig } from './config';

/**
 * The TLS certificate, which CloudFront will only accept from us-east-1 whatever region
 * the application runs in. Created only when a custom hostname is configured.
 */
export class SlcEdgeStack extends Stack {
  /** Undefined when serving on CloudFront's own domain, which needs no certificate. */
  readonly certificate?: acm.ICertificate;

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

  }
}
