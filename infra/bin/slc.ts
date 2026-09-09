#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { readConfig } from '../lib/config';
import { SlcEdgeStack } from '../lib/edge-stack';
import { SlcAppStack } from '../lib/app-stack';
import { SlcEdgeMonitoringStack } from '../lib/edge-monitoring-stack';

const app = new cdk.App();
const config = readConfig(app);
const prefix = `Slc-${config.stage}`;

// CloudFront will only take a certificate and a web ACL from us-east-1, wherever the
// application itself runs.
const edge = new SlcEdgeStack(app, `${prefix}-Edge`, {
  env: { account: config.account, region: 'us-east-1' },
  crossRegionReferences: true,
  description: 'TLS certificate and web ACL for the SLC Career & Course Finder',
  config
});

const application = new SlcAppStack(app, `${prefix}-App`, {
  env: { account: config.account, region: config.region },
  crossRegionReferences: true,
  description: 'Static assets, server and distribution for the SLC Career & Course Finder',
  config,
  certificate: edge.certificate,
  webAclArn: edge.webAclArn
});

application.addStackDependency(edge);

// CloudFront metrics are only published in us-east-1, and an alarm has to live in the
// region of the metric it watches. This deploys last, after the distribution exists.
const edgeMonitoring = new SlcEdgeMonitoringStack(app, `${prefix}-EdgeMonitoring`, {
  env: { account: config.account, region: 'us-east-1' },
  crossRegionReferences: true,
  description: 'CloudFront alarms for the SLC Career & Course Finder',
  config,
  distributionId: application.distributionId
});

edgeMonitoring.addStackDependency(application);

cdk.Tags.of(app).add('Service', 'slc-career-course-finder');
cdk.Tags.of(app).add('Stage', config.stage);
cdk.Tags.of(app).add('Owner', 'South London College');

app.synth();
