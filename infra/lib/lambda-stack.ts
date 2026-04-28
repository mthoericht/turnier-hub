import * as cdk from "aws-cdk-lib";
import {
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_lambda_nodejs as lambdaNodejs,
  aws_secretsmanager as secretsmanager,
  custom_resources as cr,
} from "aws-cdk-lib";
import * as path from "node:path";
import { Construct } from "constructs";

export type LambdaStackProps = cdk.StackProps & {
  namePrefix: string;
  vpc: ec2.IVpc;
  appSecurityGroup: ec2.ISecurityGroup;
  databaseSecret: secretsmanager.ISecret;
  jwtSecret: secretsmanager.ISecret;
  inviteCodeSecret: secretsmanager.ISecret;
  realtimeEventsTableName: string;
  rateLimitTableName: string;
  loginLockoutTableName: string;
  dbProxyEndpoint: string;
};

export class LambdaStack extends cdk.Stack
{
  public readonly apiFunction: lambda.Function;
  public readonly sseFunction: lambda.Function;
  public readonly migrateFunction: lambda.Function;
  public readonly apiFunctionUrl: lambda.FunctionUrl;
  public readonly sseFunctionUrl: lambda.FunctionUrl;

  public constructor(scope: Construct, id: string, props: LambdaStackProps)
  {
    super(scope, id, props);

    const environment = {
      NODE_ENV: "production",
      DB_PROXY_ENDPOINT: props.dbProxyEndpoint,
      DATABASE_SECRET_ARN: props.databaseSecret.secretArn,
      JWT_SECRET_ARN: props.jwtSecret.secretArn,
      INVITE_CODE_SECRET_ARN: props.inviteCodeSecret.secretArn,
      EVENT_BUS: "dynamo",
      RATE_LIMIT_STORE: "dynamo",
      LOCKOUT_STORE: "dynamo",
      REALTIME_EVENTS_TABLE: props.realtimeEventsTableName,
      RATE_LIMIT_TABLE: props.rateLimitTableName,
      LOGIN_LOCKOUT_TABLE: props.loginLockoutTableName,
      CORS_ALLOWED_ORIGINS: "https://example.invalid",
      TRUST_PROXY: "1",
      JSON_BODY_LIMIT: "100kb",
      DEFAULT_SCHOOL_NAME: "defaultSchool",
    };

    const apiLogGroup = new logs.LogGroup(this, "ApiFunctionLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
    });
    const sseLogGroup = new logs.LogGroup(this, "SseFunctionLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
    });
    const migrateLogGroup = new logs.LogGroup(this, "MigrateFunctionLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
    });
    const migrationProviderLogGroup = new logs.LogGroup(this, "MigrationProviderLogGroup", {
      retention: logs.RetentionDays.ONE_WEEK,
    });

    this.apiFunction = new lambdaNodejs.NodejsFunction(this, "ApiFunction", {
      functionName: `${props.namePrefix}-api`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, "../../server/src/lambda/httpHandler.ts"),
      handler: "handler",
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      logGroup: apiLogGroup,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.appSecurityGroup],
      environment,
      bundling: {
        format: lambdaNodejs.OutputFormat.ESM,
        target: "node22",
        sourceMap: true,
      },
    });

    this.sseFunction = new lambdaNodejs.NodejsFunction(this, "SseFunction", {
      functionName: `${props.namePrefix}-sse`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, "../../server/src/lambda/sseHandler.ts"),
      handler: "handler",
      memorySize: 1024,
      timeout: cdk.Duration.minutes(15),
      logGroup: sseLogGroup,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.appSecurityGroup],
      environment,
      bundling: {
        format: lambdaNodejs.OutputFormat.ESM,
        target: "node22",
        sourceMap: true,
      },
    });

    this.apiFunctionUrl = this.apiFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      invokeMode: lambda.InvokeMode.BUFFERED,
      cors: {
        allowedOrigins: ["*"],
        allowedHeaders: ["*"],
        allowedMethods: [lambda.HttpMethod.ALL],
      },
    });

    this.sseFunctionUrl = this.sseFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowedOrigins: ["*"],
        allowedHeaders: ["*"],
        allowedMethods: [lambda.HttpMethod.GET, lambda.HttpMethod.OPTIONS],
      },
    });

    // Allow CloudFront (SigV4-signed Function URL calls) to invoke both lambdas.
    // SourceArn scoping to a specific distribution will be added once edge wiring
    // is finalized without introducing stack dependency cycles.
    for (const fn of [this.apiFunction, this.sseFunction])
    {
      fn.addPermission(`${fn.node.id}InvokeUrlFromCloudFront`, {
        principal: new iam.ServicePrincipal("cloudfront.amazonaws.com"),
        action: "lambda:InvokeFunctionUrl",
        functionUrlAuthType: lambda.FunctionUrlAuthType.AWS_IAM,
      });
      fn.addPermission(`${fn.node.id}InvokeFromCloudFrontViaFunctionUrl`, {
        principal: new iam.ServicePrincipal("cloudfront.amazonaws.com"),
        action: "lambda:InvokeFunction",
        invokedViaFunctionUrl: true,
      });
    }

    const secrets = [props.databaseSecret, props.jwtSecret, props.inviteCodeSecret];
    for (const secret of secrets)
    {
      secret.grantRead(this.apiFunction);
      secret.grantRead(this.sseFunction);
    }

    this.migrateFunction = new lambda.Function(this, "MigrateFunction", {
      functionName: `${props.namePrefix}-migrate`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log("migrate custom resource event", JSON.stringify(event));
          return {
            PhysicalResourceId: "turnier-hub-migrate-on-deploy",
            Data: { status: "noop-placeholder" }
          };
        };
      `),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      logGroup: migrateLogGroup,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.appSecurityGroup],
      environment,
    });

    for (const secret of secrets)
    {
      secret.grantRead(this.migrateFunction);
    }

    const migrationProvider = new cr.Provider(this, "MigrationProvider", {
      onEventHandler: this.migrateFunction,
      logGroup: migrationProviderLogGroup,
    });

    new cdk.CustomResource(this, "MigrationTrigger", {
      serviceToken: migrationProvider.serviceToken,
      properties: {
        Version: "phase4-bootstrap",
      },
    });

    new cdk.CfnOutput(this, "ApiFunctionUrlOutput", {
      value: this.apiFunctionUrl.url,
    });

    new cdk.CfnOutput(this, "SseFunctionUrlOutput", {
      value: this.sseFunctionUrl.url,
    });
  }
}
