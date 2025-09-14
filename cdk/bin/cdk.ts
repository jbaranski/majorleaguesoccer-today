#!/usr/bin/env node
import * as dotenv from 'dotenv';
import * as cdk from 'aws-cdk-lib';
import { GitHubOidcStack } from '../lib/github-oidc-stack';

// Load environment variables
dotenv.config();

const app = new cdk.App();

// Get environment variables with defaults
const awsAccount = process.env.CDK_AWS_ACCOUNT;
const awsRegion = process.env.CDK_AWS_REGION;
const githubOwner = process.env.GITHUB_OWNER;
const githubRepo = process.env.GITHUB_REPO;
const githubBranch = process.env.GITHUB_BRANCH;
const required = [awsAccount, awsRegion, githubOwner, githubRepo, githubBranch];

required.forEach((envVar) => {
  if (!envVar) {
    throw new Error('Missing required environment variable');
  }
});

// Stack properties
const props: cdk.StackProps = {
  env: {
    account: awsAccount,
    region: awsRegion
  },
  description: 'GitHub Actions OIDC integration for MLS Today automation'
};

// Create the GitHub OIDC stack
new GitHubOidcStack(app, 'MLSTodayGitHubOidcStack', {
  ...props,
  githubOwner: githubOwner!,
  githubRepo: githubRepo!,
  githubBranch: githubBranch!
});
