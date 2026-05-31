import * as cdk from "aws-cdk-lib";
import {
  aws_cognito as cognito,
  aws_ec2 as ec2,
  aws_lambda as lambda,
  aws_lambda_nodejs as lambdaNodejs,
  aws_logs as logs,
  aws_secretsmanager as secretsmanager,
} from "aws-cdk-lib";
import * as path from "node:path";
import { Construct } from "constructs";

export type CognitoStackProps = cdk.StackProps & {
  namePrefix: string;
  vpc: ec2.IVpc;
  appSecurityGroup: ec2.ISecurityGroup;
  databaseSecret: secretsmanager.ISecret;
  inviteCodeSecret: secretsmanager.ISecret;
  dbProxyEndpoint: string;
};

/**
 * AWS Cognito layer that replaces the self-built JWT/bcrypt auth stack.
 *
 * Contains the user pool (email sign-in, `preferred_username`, `custom:schoolId`),
 * a public SPA app client (SRP + refresh, no secret), and the two Lambda
 * triggers that carry the application-specific signup logic:
 *
 *  - **PreSignUp** validates the shared invite code.
 *  - **PostConfirmation** creates/links the matching RDS `User` row.
 *
 * Roles stay Postgres-managed, so no Cognito groups are defined here.
 *
 * Runtime secret → env resolution (DATABASE_URL/INVITE_CODE from Secrets
 * Manager) is handled by the shared `bootstrapSecretsIntoEnv()` step at the top
 * of each trigger handler; the env wiring and secret read grants are below.
 */
export class CognitoStack extends cdk.Stack
{
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly preSignUpFunction: lambda.Function;
  public readonly postConfirmationFunction: lambda.Function;

  public constructor(scope: Construct, id: string, props: CognitoStackProps)
  {
    super(scope, id, props);

    const triggerEnvironment = {
      NODE_ENV: "production",
      DB_PROXY_ENDPOINT: props.dbProxyEndpoint,
      DATABASE_SECRET_ARN: props.databaseSecret.secretArn,
      INVITE_CODE_SECRET_ARN: props.inviteCodeSecret.secretArn,
      DEFAULT_SCHOOL_NAME: "defaultSchool",
    };

    const bundling = {
      format: lambdaNodejs.OutputFormat.ESM,
      target: "node22",
      sourceMap: true,
    };

    const preSignUpLogGroup = new logs.LogGroup(this, "PreSignUpLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
    });
    const postConfirmationLogGroup = new logs.LogGroup(this, "PostConfirmationLogGroup", {
      retention: logs.RetentionDays.ONE_MONTH,
    });

    // Invite-code validation only — no DB access required, so kept out of the VPC
    // for faster cold starts.
    this.preSignUpFunction = new lambdaNodejs.NodejsFunction(this, "PreSignUpFunction", {
      functionName: `${props.namePrefix}-cognito-pre-signup`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, "../../server/src/lambda/cognito/preSignUp.ts"),
      handler: "handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      logGroup: preSignUpLogGroup,
      environment: triggerEnvironment,
      bundling,
    });

    // Creates/links the RDS user row, so it needs VPC + DB access.
    this.postConfirmationFunction = new lambdaNodejs.NodejsFunction(this, "PostConfirmationFunction", {
      functionName: `${props.namePrefix}-cognito-post-confirmation`,
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, "../../server/src/lambda/cognito/postConfirmation.ts"),
      handler: "handler",
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      logGroup: postConfirmationLogGroup,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.appSecurityGroup],
      environment: triggerEnvironment,
      bundling,
    });

    props.inviteCodeSecret.grantRead(this.preSignUpFunction);
    props.databaseSecret.grantRead(this.postConfirmationFunction);

    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `${props.namePrefix}-users`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        preferredUsername: { required: false, mutable: true },
      },
      customAttributes: {
        schoolId: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.OFF,
      lambdaTriggers: {
        preSignUp: this.preSignUpFunction,
        postConfirmation: this.postConfirmationFunction,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.userPoolClient = this.userPool.addClient("SpaClient", {
      userPoolClientName: `${props.namePrefix}-spa`,
      generateSecret: false,
      authFlows: {
        userSrp: true,
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    new cdk.CfnOutput(this, "UserPoolIdOutput", {
      value: this.userPool.userPoolId,
    });

    new cdk.CfnOutput(this, "UserPoolClientIdOutput", {
      value: this.userPoolClient.userPoolClientId,
    });
  }
}
