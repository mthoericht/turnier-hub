export type TurnierHubStage = "dev" | "staging" | "prod";

export type InfraConfig = {
  project: string;
  stage: TurnierHubStage;
  region: string;
  account?: string;
  domainName?: string;
  hostedZoneDomain?: string;
  jwtSecretName: string;
  inviteCodeSecretName: string;
};

function readEnv(key: string): string | undefined
{
  const raw = process.env[key];
  if (!raw)
  {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function loadConfig(): InfraConfig
{
  const stage = (readEnv("TURNIER_HUB_STAGE") ?? "dev") as TurnierHubStage;
  const region = readEnv("CDK_DEFAULT_REGION") ?? readEnv("AWS_REGION") ?? "eu-central-1";

  return {
    project: readEnv("TURNIER_HUB_PROJECT") ?? "turnier-hub",
    stage,
    region,
    account: readEnv("CDK_DEFAULT_ACCOUNT"),
    domainName: readEnv("TURNIER_HUB_DOMAIN_NAME"),
    hostedZoneDomain: readEnv("TURNIER_HUB_HOSTED_ZONE_DOMAIN"),
    jwtSecretName: readEnv("TURNIER_HUB_JWT_SECRET_NAME") ?? "/turnier-hub/dev/jwt-secret",
    inviteCodeSecretName: readEnv("TURNIER_HUB_INVITE_CODE_SECRET_NAME") ?? "/turnier-hub/dev/invite-code",
  };
}
