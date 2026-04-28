import * as cdk from "aws-cdk-lib";
import {
  aws_dynamodb as dynamodb,
  aws_ec2 as ec2,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export type DataStackProps = cdk.StackProps & {
  namePrefix: string;
  vpc: ec2.IVpc;
  appSecurityGroup: ec2.ISecurityGroup;
  jwtSecretName: string;
  inviteCodeSecretName: string;
};

export class DataStack extends cdk.Stack
{
  public readonly databaseSecret: secretsmanager.ISecret;
  public readonly jwtSecret: secretsmanager.ISecret;
  public readonly inviteCodeSecret: secretsmanager.ISecret;
  public readonly database: rds.DatabaseInstance;
  public readonly proxy: rds.DatabaseProxy;
  public readonly realtimeEventsTable: dynamodb.Table;
  public readonly rateLimitTable: dynamodb.Table;
  public readonly loginLockoutTable: dynamodb.Table;

  public constructor(scope: Construct, id: string, props: DataStackProps)
  {
    super(scope, id, props);

    const dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
      vpc: props.vpc,
      allowAllOutbound: false,
      description: "RDS and RDS Proxy security group",
      securityGroupName: `${props.namePrefix}-db-sg`,
    });

    this.database = new rds.DatabaseInstance(this, "Postgres", {
      instanceIdentifier: `${props.namePrefix}-postgres`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [dbSecurityGroup],
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      databaseName: "turnier",
      backupRetention: cdk.Duration.days(7),
      deleteAutomatedBackups: true,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      credentials: rds.Credentials.fromGeneratedSecret("turnier"),
    });
    this.database.connections.allowDefaultPortFrom(props.appSecurityGroup, "Allow Lambda access to PostgreSQL");

    this.databaseSecret = this.database.secret!;

    this.proxy = this.database.addProxy("Proxy", {
      dbProxyName: `${props.namePrefix}-proxy`,
      vpc: props.vpc,
      requireTLS: true,
      securityGroups: [dbSecurityGroup],
      secrets: [this.databaseSecret],
      iamAuth: false,
      debugLogging: false,
      maxConnectionsPercent: 90,
      maxIdleConnectionsPercent: 50,
      borrowTimeout: cdk.Duration.seconds(15),
    });

    this.realtimeEventsTable = new dynamodb.Table(this, "RealtimeEventsTable", {
      tableName: `${props.namePrefix}-realtime-events`,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "ts", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.rateLimitTable = new dynamodb.Table(this, "RateLimitTable", {
      tableName: `${props.namePrefix}-rate-limit`,
      partitionKey: { name: "key", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.loginLockoutTable = new dynamodb.Table(this, "LoginLockoutTable", {
      tableName: `${props.namePrefix}-login-lockout`,
      partitionKey: { name: "key", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.jwtSecret = new secretsmanager.Secret(this, "JwtSecret", {
      secretName: props.jwtSecretName,
      description: "JWT signing secret for turnier-hub",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ value: "" }),
        generateStringKey: "value",
        excludePunctuation: true,
        passwordLength: 64,
      },
    });

    this.inviteCodeSecret = new secretsmanager.Secret(this, "InviteCodeSecret", {
      secretName: props.inviteCodeSecretName,
      description: "Invite code used for account signup",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ value: "" }),
        generateStringKey: "value",
        excludePunctuation: true,
        passwordLength: 24,
      },
    });
  }
}
