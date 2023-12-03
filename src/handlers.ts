import {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  Context,
} from "aws-lambda";
import fs from "node:fs/promises";
import path from "node:path";
import * as settings from "./settings.js";
import * as helpers from "./helpers.js";

export const http: APIGatewayProxyHandlerV2 = async (event, context) => {
  const data_env = sanitize_env(process.env);
  const data_settings = sanitize_settings(settings);

  const data_event = sanitize_event(event);
  const data_context = sanitize_context(context);

  // NODE_PATH 따라가면 node_modules 목록을 얻을 수 있다
  const data_nodepath = await readdir_nodepath(process.env.NODE_PATH ?? "");

  const output = {
    event: data_event,
    context: data_context,
    env: data_env,
    settings: data_settings,
    nodepath: data_nodepath,
  };

  // TODO: 적당히 이쁘게 보이도록
  return {
    statusCode: 200,
    body: JSON.stringify(output, null, 2),
  };
};

/**
 * @link https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html
 */
const sanitize_env = (env: NodeJS.ProcessEnv) => {
  const entries_input = Object.entries(env);

  // Reserved environment variables 중에서 AWS_, LAMBDA_ 로 시작하지 않는거
  const keys_reserved = ["_HANDLER", "_X_AMZN_TRACE_ID"];

  // Unreserved environment variables 중에서 AWS_, LAMBDA_ 로 시작하지 않는거
  const keys_unreserved = [
    "LANG",
    "PATH",
    "LD_LIBRARY_PATH",
    "NODE_PATH",
    "PYTHONPATH",
    "GEM_PATH",
    "TZ",
  ];

  // 외부로 보이고 싶지 않은 키
  const keys_secret = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
  ];

  const entries = entries_input
    .map((entry) => {
      const [key, _] = entry;
      return keys_secret.includes(key)
        ? ([key, "********"] as typeof entry)
        : entry;
    })
    .filter(([key, _]) => {
      return (
        key.startsWith("AWS_") ||
        key.startsWith("LAMBDA_") ||
        keys_reserved.includes(key) ||
        keys_unreserved.includes(key)
      );
    });
  return Object.fromEntries(entries);
};

const fakeAccountId = "123456789012";
const fakeApiId = "abcdefghij";

const sanitize_event = (event: APIGatewayProxyEventV2) => {
  const next = event;

  const accountId = next.requestContext.accountId;
  const apiId = next.requestContext.apiId;

  const sanitize_accountId = (x: string) => x.replace(accountId, fakeAccountId);
  const sanitize_apiId = (x: string) => x.replace(apiId, fakeApiId);
  const sanitize_text = (x: string) => sanitize_accountId(sanitize_apiId(x));

  const prev_requestContext = next.requestContext;
  const next_requestContext: (typeof next)["requestContext"] = {
    ...next.requestContext,
    accountId: sanitize_text(prev_requestContext.accountId),
    apiId: sanitize_text(prev_requestContext.apiId),
    domainName: sanitize_text(prev_requestContext.domainName),
    domainPrefix: sanitize_text(prev_requestContext.domainPrefix),
  };
  next.requestContext = next_requestContext;

  return next;
};

const sanitize_context = (context: Context) => {
  const next = context;
  const accountId = helpers.extractAccountIdFromFunctionArn(
    next.invokedFunctionArn
  );
  next.invokedFunctionArn = next.invokedFunctionArn.replace(
    accountId,
    fakeAccountId
  );
  return next;
};

const sanitize_settings = (s: typeof settings) => {
  return {
    NODE_ENV: s.NODE_ENV,
    STAGE: s.STAGE,
  };
};

const readdir_nodepath = async (line: string) => {
  const tokens = line.split(":").filter((x) => x.endsWith("node_modules"));
  const results = await Promise.all(
    tokens.map(async (fp: string) => {
      const founds = await readdir_directory(fp);
      const map = Object.fromEntries(founds);
      return [fp, map] as const;
    })
  );
  return Object.fromEntries(results);
};

const readdir_directory = async (
  fp: string
): Promise<(readonly [string, string])[]> => {
  const founds = await fs.readdir(fp, { withFileTypes: true });
  const founds_library = founds.filter((x) => {
    if (x.isFile()) {
      return false;
    }
    if (x.name.startsWith(".")) {
      // .bin, .pnpm, .cache ...
      return false;
    }
    if (x.name.startsWith("@types")) {
      // 타입정의는 런타임에 필요 없다
      return false;
    }

    return true;
  });

  const entries = await Promise.all(
    founds_library.map(async (f) => {
      const version = await readdir_version(path.join(fp, f.name));
      return [f.name, version] as const;
    })
  );

  return entries;
};

const readdir_version = async (fp: string): Promise<string> => {
  try {
    const packageJsonFilePath = path.join(fp, "package.json");
    const text = await fs.readFile(packageJsonFilePath, "utf-8");
    const data = JSON.parse(text);
    const version = data.version;
    return version;
  } catch (e) {
    // 파싱 실패, 또는 파일 열기 실패
    // 디렉토리 구조같은거 뜯어봐야한다
    return "<UNKNOWN>";
  }
};
