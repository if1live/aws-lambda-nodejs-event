import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  PostToConnectionCommandOutput,
} from "@aws-sdk/client-apigatewaymanagementapi";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
  APIGatewayProxyWebsocketEventV2,
  Context,
} from "aws-lambda";
import * as settings from "../settings.js";

export const dispatch: APIGatewayProxyHandler = async (event, context) => {
  const eventType = event.requestContext.eventType;
  switch (eventType) {
    case "CONNECT":
      return await handle_connect(event, context);
    case "DISCONNECT":
      return await handle_disconnect(event, context);
    case "MESSAGE": {
      const evt = event as APIGatewayProxyWebsocketEventV2;
      return await handle_message(evt, context);
    }
    default: {
      throw new Error("unknown event.requestContext.eventType", {
        cause: {
          eventType,
        },
      });
    }
  }
};

export const handle_connect = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  console.log("connect.event", JSON.stringify(event, null, 2));

  const connectionId = event.requestContext.connectionId;
  console.log("connect", connectionId);

  const query = event.queryStringParameters ?? {};

  let statusCode = 200;
  if (query.status) {
    const parsed = parseInt(query.status, 10);
    if (parsed) {
      statusCode = parsed;
    }
  }

  if (query.exc) {
    throw new Error(query.exc, { cause: query });
  }

  return {
    statusCode,
    body: "OK",
  };
};

export const handle_disconnect = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  console.log("disconnect.event", JSON.stringify(event, null, 2));

  const connectionId = event.requestContext.connectionId;
  console.log("disconnect", connectionId);

  return {
    statusCode: 200,
    body: "OK",
  };
};

export const handle_message = async (
  event: APIGatewayProxyWebsocketEventV2,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  console.log("message.event", JSON.stringify(event, null, 2));

  const connectionId = event.requestContext.connectionId;
  console.log("message", connectionId);

  const endpoint = deriveEndpoint(event);
  const client = new ApiGatewayManagementApiClient({
    endpoint,
    region: settings.AWS_REGION,
  });
  const output = await client.send(
    new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: event.body ?? "<BLANK>",
    }),
  );

  return {
    statusCode: 200,
    body: "OK",
  };
};

function deriveEndpoint(
  event: APIGatewayProxyEvent | APIGatewayProxyWebsocketEventV2,
): string {
  // lambda: f3w1jmmhb3.execute-api.ap-northeast-2.amazonaws.com/dev
  // offline: private.execute-api.ap-northeast-2.amazonaws.com/local
  const region = settings.AWS_REGION;

  const apiId = event.requestContext.apiId;
  const stage = event.requestContext.stage;

  const endpoint_prod = `https://${apiId}.execute-api.${region}.amazonaws.com/${stage}`;

  // APIGatewayProxyWebsocketEventV2로는 포트 정보까지 얻을 수 없다.
  // 로컬이라고 가정되면 좌표가 뻔해서 편법을 써도 된다
  const endpoint_private = "http://127.0.0.1:3001";

  return apiId === "private" ? endpoint_private : endpoint_prod;
}
