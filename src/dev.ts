import { FunctionDefinition, standalone } from "serverless-standalone";
import * as http_main from "./handlers/http_main.js";
import * as ws_main from "./handlers/ws_main.js";
import * as settings from "./settings.js";

const serviceName = "aws-lambda-probe";
const prefix = `${serviceName}-${settings.STAGE}`;

const definitions: FunctionDefinition[] = [
  {
    name: `${prefix}-http`,
    handler: http_main.handle,
    events: [
      { httpApi: { route: "ANY /" } },
      { httpApi: { route: "ANY /{pathname+}" } },
    ],
  },
  {
    name: `${prefix}-websocket`,
    handler: ws_main.dispatch,
    events: [
      { websocket: { route: "$connect" } },
      { websocket: { route: "$disconnect" } },
      { websocket: { route: "$default" } },
    ],
  },
];

const options = {
  httpApi: { port: 3000 },
  websocket: { port: 3001 },
  lambda: { port: 3002 },
};

const inst = standalone({
  ...options,
  functions: definitions,
});
await inst.start();
console.log("standalone", options);
