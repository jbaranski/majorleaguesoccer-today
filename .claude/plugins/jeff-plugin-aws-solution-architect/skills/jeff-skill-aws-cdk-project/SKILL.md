---
name: jeff-skill-aws-cdk-project
description: Configure or update AWS CDK TypeScript projects with an opinionated layout, required dependencies, scripts, .env usage, required CDK defaults (DESTROY removal policy, 5-day log retention, exact-action IAM), infra tests, and a GitHub Actions test-and-deploy workflow. Use when a repo should contain a CDK project. CDK app code lives in a `cdk/` folder off the root of the project.
---

This is an opinionated view for how AWS CDK projects should be configured and maintained.

## Prerequisites

1. Node.js via the `jeff-skill-install-nodejs` skill; Prettier via `jeff-skill-install-prettier`.
2. Use WebSearch to verify the latest `aws-cdk-lib`, `aws-cdk` (CLI), `constructs`, TypeScript, Vitest and Node LTS versions. Fill in every `<latest>` below with verified versions; don't guess.

## Layout

```
cdk/
├── bin/app.ts           # the only app entrypoint
├── lib/
│   ├── stack.ts         # usually the only stack
│   └── *-construct.ts   # one construct per file (lib/constructs/ once there are 30+ and several stacks)
├── test/
│   ├── constructs/      # construct tests
│   └── stack/           # stack-level assertions
├── cdk.json
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env                 # gitignored
├── .env.example         # committed, sample values
└── .npmrc               # engine-strict=true
```

- One stack is the norm. If asked for more, confirm it's really needed first.
- One construct per file. Closely related resources of the same kind (several Lambdas for one feature, related tables) may share a construct; don't mix kinds (Lambda + DynamoDB) in one.
- Build/deploy arguments (account, region, rate limits, alarm periods, allowed origins, ARNs of external resources) come from `cdk/.env`, documented in `.env.example`.

## package.json

Runtime dependencies are exactly these; anything else needs the user's confirmation:

```json
"dependencies": {
  "aws-cdk-lib": "<latest>",
  "constructs": "<latest>",
  "dotenv": "<latest>"
},
"devDependencies": {
  "aws-cdk": "<latest>",
  "typescript": "<latest>",
  "tsx": "<latest>",
  "vitest": "<latest>",
  "@vitest/coverage-v8": "<latest>",
  "@types/node": "^<NODE_LTS>.0.0"
},
"engines": {
  "node": ">= <NODE_LTS>.0.0"
},
"scripts": {
  "typecheck": "tsc --noEmit",
  "synth": "cdk synth",
  "diff": "cdk diff",
  "deploy": "npm run typecheck && cdk deploy",
  "deploy:clean": "npm run clean && npm ci && npm run typecheck && npm run test:run && cdk deploy",
  "destroy": "cdk destroy",
  "clean": "rm -rf cdk.out",
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

- Use the local CLI (`npx cdk` / npm scripts), never a global install.
- Keep `cdk/` CommonJS (no `"type": "module"`) so `__dirname` works in `bin/app.ts`.
- For readable stack traces, run with Node's built-in source maps (`NODE_OPTIONS=--enable-source-maps`) rather than adding `source-map-support`.
- `.nvmrc` at the repo root holds the Node LTS major; `cdk/.npmrc` holds `engine-strict=true`.
- npm: `npm ci` in CI, fresh checkouts and Claude Code web sessions; `npm install <package>` only to add or update a dependency; never bare `npm install` in CI or scripts.

**`cdk.json`**

```json
{
  "app": "npx tsx bin/app.ts"
}
```

## App code

**`bin/app.ts`**

```typescript
import * as cdk from 'aws-cdk-lib';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { MyAppStack } from '../lib/stack';

// Works whether cdk runs from the repo root or cdk/.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = new cdk.App();

new MyAppStack(app, 'MyAppStack', {
  env: {
    account: process.env.AWS_ACCOUNT,
    region: process.env.AWS_REGION
  }
});
```

**`lib/stack.ts`** composes the constructs; each construct takes what it needs through typed props:

```typescript
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

interface OrdersLambdaConstructProps {
  ordersTable: dynamodb.ITable;
}

export class OrdersLambdaConstruct extends Construct {
  constructor(scope: Construct, id: string, props: OrdersLambdaConstructProps) {
    super(scope, id);
    // functions, log groups, permissions for props.ordersTable
  }
}
```

## Naming

All stack IDs, construct IDs and logical resource IDs are PascalCase: `'UsersTable'`, `'ApiLogGroup'`, `'ProcessOrderFunction'` — never `'users-table'`, `'apiLogGroup'` or `'process_order_function'`.

## Required CDK defaults

**Removal policy** — `removalPolicy: cdk.RemovalPolicy.DESTROY` on every resource.

**Log retention** — every log group is explicit, with `retention: logs.RetentionDays.FIVE_DAYS`; never unlimited. Give each Lambda its own `LogGroup` and pass it as `logGroup`.

**No hardcoded ARNs, account IDs or external names** — values for resources outside this stack come from `.env`:

```typescript
// BAD
const roleArn = 'arn:aws:iam::123456789012:role/MyRole';
// GOOD
const roleArn = process.env.MY_ROLE_ARN!;
```

Names of resources created in this stack may be constants.

**IAM: `addToPrincipalPolicy` with exact actions** — never L2 grant methods (`grantReadData`, `grantReadWriteData`, `grantSendMessages`, `grantConsumeMessages`, ...), which grant broader action sets than needed, and never `role.attachInlinePolicy(new iam.Policy(...))`, which adds an extra `AWS::IAM::Policy` resource and bypasses CDK dependency tracking.

```typescript
myLambda.role!.addToPrincipalPolicy(
  new iam.PolicyStatement({
    sid: 'OrdersTableQuery',
    effect: iam.Effect.ALLOW,
    actions: ['dynamodb:Query'],
    resources: [ordersTable.tableArn] // construct property, not a hand-built ARN
  })
);

// External resource: import it (name from .env) to get its ARN
const externalTable = dynamodb.Table.fromTableName(this, 'ExternalTable', process.env.EXTERNAL_TABLE_NAME!);
myLambda.role!.addToPrincipalPolicy(
  new iam.PolicyStatement({
    sid: 'ExternalTableRead',
    effect: iam.Effect.ALLOW,
    actions: ['dynamodb:GetItem'],
    resources: [externalTable.tableArn]
  })
);
```

Retry limits and DLQs for every async path are covered by the AWS agents' standards; assert them in tests too.

## Tests

Vitest, configured in `vitest.config.ts` with an 80% coverage threshold over `lib/` and `bin/`. Every construct and the stack have tests, and the tests assert the standards, not just that resources exist:

- Alarms exist for the infrastructure
- API Gateway stages have throttling
- Every log group has `RetentionInDays: 5`
- Every Lambda has explicit memory and timeout
- DynamoDB tables have point-in-time recovery (`pointInTimeRecoverySpecification`)
- Every resource has `DeletionPolicy: Delete`
- IAM statements have no `*` actions or resources (unless that is the documented way for a specific service)
- Every async event source has `MaximumRetryAttempts` set

```typescript
import { describe, expect, it } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { MyAppStack } from '../../lib/stack';

describe('MyAppStack', () => {
  const template = Template.fromStack(new MyAppStack(new App(), 'TestStack'));

  it('throttles API Gateway', () => {
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      MethodSettings: Match.arrayWith([
        Match.objectLike({ ThrottlingRateLimit: Match.anyValue(), ThrottlingBurstLimit: Match.anyValue() })
      ])
    });
  });

  it('retains logs for 5 days', () => {
    for (const logGroup of Object.values(template.findResources('AWS::Logs::LogGroup'))) {
      expect(logGroup.Properties.RetentionInDays).toBe(5);
    }
  });
});
```

## GitHub Actions

`.github/workflows/cdk.yml`: tests on every PR; tests then deploy on every push to `main`. Authenticate with GitHub OIDC and an IAM role (`AWS_DEPLOY_ROLE_ARN` secret) — never long-lived access keys. Apply the Dependabot guard from `jeff-skill-install-dependabot` to every job.

```yaml
name: cdk

on:
  push:
    branches: [main]
    paths: ['cdk/**', '.github/workflows/cdk.yml']
  pull_request:
    branches: [main]
    paths: ['cdk/**', '.github/workflows/cdk.yml']

permissions:
  contents: read

concurrency:
  group: cdk-deploy
  cancel-in-progress: false

jobs:
  test:
    if: github.actor != 'dependabot[bot]' && github.event.pull_request.user.login != 'dependabot[bot]'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: cdk
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: cdk/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npx prettier --check .
      - run: npm run test:coverage

  deploy:
    needs: test
    if: github.event_name == 'push' && github.actor != 'dependabot[bot]'
    runs-on: ubuntu-latest
    environment: prod
    permissions:
      contents: read
      id-token: write # OIDC
    defaults:
      run:
        working-directory: cdk
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: cdk/package-lock.json
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: us-east-1
      - run: npm ci
      - run: npx cdk deploy --all --require-approval never
        env:
          AWS_ACCOUNT: ${{ secrets.AWS_ACCOUNT }}
          AWS_REGION: us-east-1
          # plus every other value cdk/.env normally provides
```

## References

- [Working with the AWS CDK in TypeScript](https://docs.aws.amazon.com/cdk/v2/guide/work-with-cdk-typescript.html)
- [AWS Construct Library API](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html)
- [CDK assertions](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.assertions-readme.html)
- [Vitest coverage](https://vitest.dev/guide/coverage.html)
- [GitHub OIDC with AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)
