#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EC2Stack } from '../src/stacks/EC2Stack';

const app = new cdk.App();

new EC2Stack(app, 'FamilyTreeStack', {
  env: { account: '777312966064', region: 'us-east-1' },
  description: 'Family tree app — EC2 t4g.small + Postgres EBS + Nginx',
});
