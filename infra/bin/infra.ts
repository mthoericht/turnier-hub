#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { loadConfig } from "../lib/config";
import { DataStack } from "../lib/data-stack";
import { EdgeStack } from "../lib/edge-stack";
import { LambdaStack } from "../lib/lambda-stack";
import { NetworkStack } from "../lib/network-stack";

const app = new cdk.App();
const config = loadConfig();

const namePrefix = `${config.project}-${config.stage}`;
const env = {
  account: config.account,
  region: config.region,
};

const networkStack = new NetworkStack(app, `${namePrefix}-network`, {
  env,
  namePrefix,
  description: "Shared networking layer for turnier-hub AWS deployment",
});

const dataStack = new DataStack(app, `${namePrefix}-data`, {
  env,
  namePrefix,
  vpc: networkStack.vpc,
  appSecurityGroup: networkStack.appSecurityGroup,
  jwtSecretName: config.jwtSecretName,
  inviteCodeSecretName: config.inviteCodeSecretName,
  description: "Data services (RDS, DynamoDB, Secrets Manager) for turnier-hub",
});

const lambdaStack = new LambdaStack(app, `${namePrefix}-lambda`, {
  env,
  namePrefix,
  vpc: networkStack.vpc,
  appSecurityGroup: networkStack.appSecurityGroup,
  databaseSecret: dataStack.databaseSecret,
  jwtSecret: dataStack.jwtSecret,
  inviteCodeSecret: dataStack.inviteCodeSecret,
  realtimeEventsTableName: dataStack.realtimeEventsTable.tableName,
  rateLimitTableName: dataStack.rateLimitTable.tableName,
  loginLockoutTableName: dataStack.loginLockoutTable.tableName,
  dbProxyEndpoint: dataStack.proxy.endpoint,
  description: "Application Lambdas (REST, SSE, migration trigger) for turnier-hub",
});

const apiUrlDomainName = cdk.Fn.select(2, cdk.Fn.split("/", lambdaStack.apiFunctionUrl.url));
const sseUrlDomainName = cdk.Fn.select(2, cdk.Fn.split("/", lambdaStack.sseFunctionUrl.url));

const edgeStack = new EdgeStack(app, `${namePrefix}-edge`, {
  env,
  namePrefix,
  apiFunctionUrlDomainName: apiUrlDomainName,
  sseFunctionUrlDomainName: sseUrlDomainName,
  domainName: config.domainName,
  hostedZoneDomain: config.hostedZoneDomain,
  description: "Edge layer (CloudFront, S3, WAF, optional DNS) for turnier-hub",
});

app.synth();
