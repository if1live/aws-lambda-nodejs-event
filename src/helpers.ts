export const extractAccountIdFromFunctionArn = (arn: string): string => {
  const tokens = arn.split(":");
  return tokens[4] ?? "";
};
