#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { readConfig } from '../lib/config';
import { SlcEdgeStack } from '../lib/edge-stack';
import { SlcAppStack } from '../lib/app-stack';

const app = new cdk.App();
const config = readConfig(app);
const prefix = `Slc-${config.stage}`;

// CloudFront takes a certificate only from us-east-1. With no custom hostname there
// is nothing to certify, so this stack is not created at all and the account carries
// no resources outside London.
const edge = config.domainName
  ? new SlcEdgeStack(app, `${prefix}-Edge`, {
      env: { account: config.account, region: 'us-east-1' },
      crossRegionReferences: true,
      description: 'TLS certificate for the SLC Career & Course Finder',
      config
    })
  : undefined;

const application = new SlcAppStack(app, `${prefix}-App`, {
  env: { account: config.account, region: config.region },
  crossRegionReferences: true,
  description: 'Static assets, server and distribution for the SLC Career & Course Finder',
  config,
  certificate: edge?.certificate
});

if (edge) application.addStackDependency(edge);

cdk.Tags.of(app).add('Service', 'slc-career-course-finder');
cdk.Tags.of(app).add('Stage', config.stage);
cdk.Tags.of(app).add('Owner', 'South London College');

app.synth();
