#!/usr/bin/env node
import { inviteCodeSecretName, readInviteCodeValue } from "./aws-smoke-lib.mjs";

try
{
  const code = readInviteCodeValue();
  console.log(`Secret: ${inviteCodeSecretName()}`);
  console.log(`Invite code: ${code}`);
}
catch (error)
{
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
