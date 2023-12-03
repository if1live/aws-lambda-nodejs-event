import {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  Context,
} from "aws-lambda";
import fs from "node:fs/promises";
import path from "node:path";
import * as settings from "./settings.js";
import * as helpers from "./helpers.js";
import { Result } from "./types.js";

export const http: APIGatewayProxyHandlerV2 = async (event, context) => {
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
  const data_env = helpers.sanitize_env(process.env);
  const data_settings = helpers.sanitize_settings(settings);

  const data_event = helpers.sanitize_event(event);
  const data_context = helpers.sanitize_context(context);

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
const validate_nodepath = async (fp: string): Promise<Result<boolean>> => {
  try {
    const stat = await fs.stat(fp);
    if (stat.isFile()) {
      const err = new Error("NODE_PATH is file");
      (err as any).path = fp;
      return { ok: false, reason: err };
    } else {
      return { ok: true, value: true };
    }
  } catch (e) {
    if (e instanceof Error) {
      return { ok: false, reason: e };
    } else {
      const err = new Error("Unknown error");
      (err as any).path = fp;
      return { ok: false, reason: err };
    }
  }
};

const readdir_nodepath = async (line: string) => {
  const tokens = line.split(":").filter((x) => x.endsWith("node_modules"));

  // 실제로 존재하는 node_modules 디렉토리만 관심있다
  const directories_candidate = await Promise.all(
    tokens.map(async (fp: string) => {
      const result = await validate_nodepath(fp);
      return result.ok ? fp : null;
    })
  );
  const directories = directories_candidate
    .filter((x) => x !== null)
    .map((x) => x!);

  const results = await Promise.all(
    directories.map(async (fp: string) => {
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

  const sdkName = "@aws-sdk";
  if (founds_library.length === 1 && founds_library[0]?.name === sdkName) {
    // 람다 런타임에 포함된 aws-sdk-v3의 버전에만 관심있다
    // node_modules에 @aws-sdk 하나만 있는 경우는 localhost에서는 없다
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
      })
    );
    return entries;
  } else {
    // localhost에서 테스트할때 진입
    const entries = await Promise.all(
      founds_library.map(async (f) => {
        const version = await readdir_version(path.join(fp, f.name));
        return [f.name, version] as const;
      })
    );
    return entries;
  }
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
