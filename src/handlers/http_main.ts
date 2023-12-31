import fs from "node:fs/promises";
import path from "node:path";
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  Context,
} from "aws-lambda";
import * as helpers from "../helpers.js";
import * as settings from "../settings.js";
import { Result } from "../types.js";

export const handle: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    return await http_inner(event, context);
  } catch (e) {
    let data = e;
    if (e instanceof Error) {
      data = {
        name: e.name,
        message: e.message,
        stack: e.stack,
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify(data, null, 2),
    };
  }
};

const http_inner = async (event: APIGatewayProxyEventV2, context: Context) => {
  const env = process.env;

  const data_env = helpers.sanitize_env(env);
  const data_settings = helpers.sanitize_settings(settings);

  const data_event = helpers.sanitize_event(event);
  const data_context = helpers.sanitize_context(context);

  // NODE_PATH 따라가면 node_modules 목록을 얻을 수 있다.
  // 관심있는건 aws-sdk 목록과 버전
  const data_nodepath_sdk = await readdir_nodepath_sdk(env.NODE_PATH ?? "");

  const output = {
    event: data_event,
    context: data_context,
    env: data_env,
    settings: data_settings,
    nodepath_sdk: data_nodepath_sdk,
  };

  // TODO: 적당히 이쁘게 보이도록
  return {
    statusCode: 200,
    body: JSON.stringify(output, null, 2),
  };
};

/**
 * @summary NODE_PATH 내부 접근해서 설치된 패키지 목록, 버전 확인
 * @description
 * NODE_PATH에 정의된 경로가 항상 존재한다고 보장할수 없다.
 * 그래서 직접 열어보는 함수를 붙임.
 *
 * nodejs20.x로 실행할 경우 NODE_PATH는 다음과 같다
 *
 * - /opt/nodejs/node20/node_modules
 * - /opt/nodejs/node_modules
 * - /var/runtime/node_modules
 * - /var/runtime
 * - /var/task
 *
 * 일부 경로는 예약되어있고 실제로 존재하지 않는다.
 * message: "ENOENT: no such file or directory, scandir '/opt/nodejs/node20/node_modules'"
 *
 * 람다 런타임 문서를 찾아보면 런타임에 포함된 SDK 버전은 알 수 있다.
 * 하지만 설치된 패키지 전체 목록은 보이지 않는다.
 * aws-sdk-v3에서는 패키지를 잘게 쪼개놔서 전체 목록을 따로 보고 싶었다.
 *
 * @link https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html
 */
const validate_nodepath_sdk = async (fp: string): Promise<Result<boolean>> => {
  try {
    if (!fp.endsWith("node_modules")) {
      const err = new Error("NODE_PATH does not end with node_modules", {
        cause: {
          path: fp,
        },
      });
      return { ok: false, reason: err };
    }

    const stat = await fs.stat(path.join(fp, "@aws-sdk"));
    if (!stat.isDirectory()) {
      const err = new Error("NODE_PATH/@aws-sdk is not directory", {
        cause: { path: fp },
      });
      return { ok: false, reason: err };
    }
    return { ok: true, value: true };
  } catch (e) {
    if (e instanceof Error) {
      return { ok: false, reason: e };
    }
    const err = new Error("Unknown error", { cause: { path: fp } });
    return { ok: false, reason: err };
  }
};

const readdir_nodepath_sdk = async (line: string) => {
  const directories_candidate = await Promise.all(
    line.split(":").map(async (fp: string) => {
      const result = await validate_nodepath_sdk(fp);
      return result.ok ? fp : null;
    }),
  );
  const directories = directories_candidate
    .filter((x) => x !== null)
    .map((x) => x as string);

  const results = await Promise.all(
    directories.map(async (fp: string) => {
      const founds = await readdir_sdk(fp);
      const map = Object.fromEntries(founds);
      return [fp, map] as const;
    }),
  );
  return Object.fromEntries(results);
};

const readdir_sdk = async (
  fp: string,
): Promise<(readonly [string, string])[]> => {
  // 여기까지 진입하기전에 @aws-sdk 디렉토리의 존재는 검증되었다.
  const sdkName = "@aws-sdk";
  const sdkPath = path.join(fp, sdkName);
  const founds = await fs.readdir(sdkPath, { withFileTypes: true });
  const founds_sdk = founds.filter((x) => {
    if (x.isFile()) return false;
    if (x.name.startsWith(".")) return false;
    return true;
  });

  const entries = await Promise.all(
    founds_sdk.map(async (f) => {
      const version = await readdir_version(path.join(sdkPath, f.name));
      const name = `${sdkName}/${f.name}`;
      return [name, version] as const;
    }),
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
