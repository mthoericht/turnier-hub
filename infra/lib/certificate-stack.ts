import * as cdk from "aws-cdk-lib";
import {
  aws_certificatemanager as acm,
  aws_route53 as route53,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export type CertificateStackProps = cdk.StackProps & {
  namePrefix: string;
  domainName: string;
  hostedZoneDomain: string;
};

export class CertificateStack extends cdk.Stack
{
  public readonly certificate: acm.Certificate;

  public constructor(scope: Construct, id: string, props: CertificateStackProps)
  {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromLookup(this, "CertificateHostedZone", {
      domainName: props.hostedZoneDomain,
    });

    this.certificate = new acm.Certificate(this, "CloudFrontCertificate", {
      domainName: props.domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    new cdk.CfnOutput(this, "CloudFrontCertificateArn", {
      value: this.certificate.certificateArn,
    });
  }
}
