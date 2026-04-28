import * as cdk from "aws-cdk-lib";
import {
  aws_cloudwatch as cloudwatch,
  aws_cloudwatch_actions as cloudwatchActions,
  aws_logs as logs,
  aws_lambda as lambda,
  aws_rds as rds,
  aws_sns as sns,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export type ObservabilityStackProps = cdk.StackProps & {
  namePrefix: string;
  apiFunction: lambda.IFunction;
  sseFunction: lambda.IFunction;
  migrateFunction: lambda.IFunction;
  database: rds.IDatabaseInstance;
  webAclName: string;
};

export class ObservabilityStack extends cdk.Stack
{
  public readonly alarmTopic: sns.Topic;

  public constructor(scope: Construct, id: string, props: ObservabilityStackProps)
  {
    super(scope, id, props);

    this.alarmTopic = new sns.Topic(this, "AlarmTopic", {
      topicName: `${props.namePrefix}-alarms`,
      displayName: "Turnier Hub infrastructure alarms",
    });

    const alarmAction = new cloudwatchActions.SnsAction(this.alarmTopic);

    const lambdaFunctions = [props.apiFunction, props.sseFunction, props.migrateFunction];
    for (const fn of lambdaFunctions)
    {
      const errorRate = new cloudwatch.MathExpression({
        expression: "100 * errors / MAX([invocations, 1])",
        usingMetrics: {
          errors: fn.metricErrors({
            period: cdk.Duration.minutes(5),
            statistic: "sum",
          }),
          invocations: fn.metricInvocations({
            period: cdk.Duration.minutes(5),
            statistic: "sum",
          }),
        },
        period: cdk.Duration.minutes(5),
      });

      const errorRateAlarm = new cloudwatch.Alarm(this, `${fn.node.id}ErrorRateAlarm`, {
        alarmName: `${props.namePrefix}-${fn.functionName}-error-rate`,
        alarmDescription: "Lambda error rate exceeds 1% over 5 minutes",
        metric: errorRate,
        threshold: 1,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      errorRateAlarm.addAlarmAction(alarmAction);

      const throttlesAlarm = new cloudwatch.Alarm(this, `${fn.node.id}ThrottlesAlarm`, {
        alarmName: `${props.namePrefix}-${fn.functionName}-throttles`,
        alarmDescription: "Lambda throttles detected",
        metric: fn.metricThrottles({
          period: cdk.Duration.minutes(5),
          statistic: "sum",
        }),
        threshold: 0,
        evaluationPeriods: 1,
        datapointsToAlarm: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      throttlesAlarm.addAlarmAction(alarmAction);
    }

    const rdsCpuAlarm = new cloudwatch.Alarm(this, "RdsCpuAlarm", {
      alarmName: `${props.namePrefix}-rds-cpu-high`,
      alarmDescription: "RDS CPU exceeds 80%",
      metric: props.database.metricCPUUtilization({
        period: cdk.Duration.minutes(5),
        statistic: "avg",
      }),
      threshold: 80,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    rdsCpuAlarm.addAlarmAction(alarmAction);

    const rdsConnectionsAlarm = new cloudwatch.Alarm(this, "RdsConnectionsAlarm", {
      alarmName: `${props.namePrefix}-rds-connections-high`,
      alarmDescription: "RDS connections are high (review max_connections sizing)",
      metric: props.database.metricDatabaseConnections({
        period: cdk.Duration.minutes(5),
        statistic: "max",
      }),
      threshold: 80,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    rdsConnectionsAlarm.addAlarmAction(alarmAction);

    const wafBlockedRequests = new cloudwatch.Metric({
      namespace: "AWS/WAFV2",
      metricName: "BlockedRequests",
      dimensionsMap: {
        WebACL: props.webAclName,
        Region: "CloudFront",
        Rule: "ALL",
      },
      period: cdk.Duration.minutes(5),
      statistic: "sum",
    });

    const wafBlockedAlarm = new cloudwatch.Alarm(this, "WafBlockedAlarm", {
      alarmName: `${props.namePrefix}-waf-blocked-requests`,
      alarmDescription: "WAF blocked request count exceeded threshold",
      metric: wafBlockedRequests,
      threshold: 100,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    wafBlockedAlarm.addAlarmAction(alarmAction);

    const apiLogGroup = logs.LogGroup.fromLogGroupName(
      this,
      "ApiLogGroupRef",
      `/aws/lambda/${props.apiFunction.functionName}`,
    );

    new logs.MetricFilter(this, "SecurityMetricFilter", {
      logGroup: apiLogGroup,
      filterPattern: logs.FilterPattern.stringValue("$.category", "=", "security"),
      metricNamespace: "TurnierHub/Security",
      metricName: "SecuritySignals",
      metricValue: "1",
      defaultValue: 0,
    });

    const securitySignalsAlarm = new cloudwatch.Alarm(this, "SecuritySignalsAlarm", {
      alarmName: `${props.namePrefix}-security-signals`,
      alarmDescription: "Structured security log events exceeded threshold",
      metric: new cloudwatch.Metric({
        namespace: "TurnierHub/Security",
        metricName: "SecuritySignals",
        period: cdk.Duration.minutes(5),
        statistic: "sum",
      }),
      threshold: 20,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    securitySignalsAlarm.addAlarmAction(alarmAction);

    new cdk.CfnOutput(this, "AlarmTopicArn", {
      value: this.alarmTopic.topicArn,
    });
  }
}
