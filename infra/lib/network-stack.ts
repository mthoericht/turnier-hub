import * as cdk from "aws-cdk-lib";
import { aws_ec2 as ec2 } from "aws-cdk-lib";
import { Construct } from "constructs";

export type NetworkStackProps = cdk.StackProps & {
  namePrefix: string;
};

export class NetworkStack extends cdk.Stack
{
  public readonly vpc: ec2.Vpc;
  public readonly appSecurityGroup: ec2.SecurityGroup;

  public constructor(scope: Construct, id: string, props: NetworkStackProps)
  {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      vpcName: `${props.namePrefix}-vpc`,
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "private-app",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: "private-db",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    this.appSecurityGroup = new ec2.SecurityGroup(this, "AppSecurityGroup", {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: "Lambda application security group",
      securityGroupName: `${props.namePrefix}-lambda-sg`,
    });

    new cdk.CfnOutput(this, "VpcId", {
      value: this.vpc.vpcId,
    });
  }
}
