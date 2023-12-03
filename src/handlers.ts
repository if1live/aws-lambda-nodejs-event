import { APIGatewayProxyHandlerV2 } from "aws-lambda";

export const http: APIGatewayProxyHandlerV2 = async (event, context) => {
  // TODO:
  return {
    statusCode: 200,
    body: JSON.stringify(event),
  }
}
