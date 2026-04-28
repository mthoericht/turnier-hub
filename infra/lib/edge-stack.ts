import * as cdk from "aws-cdk-lib";
import {
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_route53_targets as route53Targets,
  aws_s3 as s3,
  aws_wafv2 as wafv2,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export type EdgeStackProps = cdk.StackProps & {
  namePrefix: string;
  apiFunctionUrlDomainName: string;
  sseFunctionUrlDomainName: string;
  certificateArn?: string;
  domainName?: string;
  hostedZoneDomain?: string;
};

export class EdgeStack extends cdk.Stack
{
  public readonly siteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly webAclName: string;

  public constructor(scope: Construct, id: string, props: EdgeStackProps)
  {
    super(scope, id, props);

    this.siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: `${props.namePrefix}-site-${cdk.Stack.of(this).account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    this.webAclName = `${props.namePrefix}-web-acl`;
    const webAcl = new wafv2.CfnWebACL(this, "WebAcl", {
      name: this.webAclName,
      scope: "CLOUDFRONT",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${props.namePrefix}-web-acl`,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "AWSManagedCommonRuleSet",
          priority: 0,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${props.namePrefix}-common-rules`,
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    const apiOrigin = new origins.HttpOrigin(props.apiFunctionUrlDomainName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    const sseOrigin = new origins.HttpOrigin(props.sseFunctionUrlDomainName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      readTimeout: cdk.Duration.seconds(60),
      keepaliveTimeout: cdk.Duration.seconds(60),
    });

    const lambdaOriginAccessControl = new cloudfront.CfnOriginAccessControl(this, "LambdaFunctionUrlOac", {
      originAccessControlConfig: {
        name: `${props.namePrefix}-lambda-url-oac`,
        originAccessControlOriginType: "lambda",
        signingBehavior: "always",
        signingProtocol: "sigv4",
      },
    });

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      domainNames: props.domainName ? [props.domainName] : undefined,
      certificate: props.certificateArn
        ? acm.Certificate.fromCertificateArn(this, "CloudFrontCertificate", props.certificateArn)
        : undefined,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        "api/sse": {
          origin: sseOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          compress: false,
        },
        "api/*": {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      defaultRootObject: "index.html",
      webAclId: webAcl.attrArn,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(1),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(1),
        },
      ],
    });

    const distributionResource = this.distribution.node.defaultChild as cloudfront.CfnDistribution;
    // Origins[1] = /api/sse function URL, Origins[2] = /api/* function URL.
    distributionResource.addPropertyOverride(
      "DistributionConfig.Origins.1.OriginAccessControlId",
      lambdaOriginAccessControl.attrId
    );
    distributionResource.addPropertyOverride(
      "DistributionConfig.Origins.2.OriginAccessControlId",
      lambdaOriginAccessControl.attrId
    );

    if (props.domainName && props.hostedZoneDomain)
    {
      const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
        domainName: props.hostedZoneDomain,
      });

      new route53.ARecord(this, "AliasRecord", {
        zone: hostedZone,
        recordName: props.domainName,
        target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
      });
    }

    new cdk.CfnOutput(this, "CloudFrontDomain", {
      value: this.distribution.distributionDomainName,
    });
  }
}
