import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface GitHubOidcStackProps extends cdk.StackProps {
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
}

export class GitHubOidcStack extends cdk.Stack {
  public readonly role: iam.Role;
  public readonly oidcProvider: iam.OpenIdConnectProvider;

  constructor(scope: Construct, id: string, props: GitHubOidcStackProps) {
    super(scope, id, props);

    // Create GitHub OIDC Provider
    this.oidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      // GitHub's OIDC thumbprints
      thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1']
    });

    // Create IAM role for GitHub Actions
    this.role = new iam.Role(this, 'GitHubActionsRole', {
      roleName: `GitHubActions-${props.githubRepo}-Role`,
      description: `Allows GitHub Actions in ${props.githubOwner}/${props.githubRepo} to query DynamoDB for email subscribers`,
      assumedBy: new iam.WebIdentityPrincipal(this.oidcProvider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:sub': `repo:${props.githubOwner}/${props.githubRepo}:ref:refs/heads/${props.githubBranch}`,
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com'
        }
      }),
      maxSessionDuration: cdk.Duration.hours(1)
    });

    this.role.addToPrincipalPolicy(new iam.PolicyStatement({
      sid: 'DynamoDBQuerySubscribers',
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:Query'],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/EmailCollector`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/EmailCollector/index/SiteIndex`
      ]
    }));

    // Output the role ARN for GitHub Secrets
    new cdk.CfnOutput(this, 'GitHubActionsRoleArn', {
      value: this.role.roleArn,
      description: 'IAM Role ARN for GitHub Actions OIDC authentication',
      exportName: `${this.stackName}-GitHubActionsRoleArn`
    });

    // Output the OIDC provider ARN
    new cdk.CfnOutput(this, 'OidcProviderArn', {
      value: this.oidcProvider.openIdConnectProviderArn,
      description: 'GitHub OIDC Provider ARN',
      exportName: `${this.stackName}-OidcProviderArn`
    });

    // Output GitHub repository configuration
    new cdk.CfnOutput(this, 'GitHubRepository', {
      value: `${props.githubOwner}/${props.githubRepo}`,
      description: 'GitHub repository configured for OIDC access'
    });
  }
}
