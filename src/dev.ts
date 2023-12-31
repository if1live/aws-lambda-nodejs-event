import { FunctionDefinition, standalone } from "serverless-standalone";
import * as http_main from "./handlers/http_main.js";

const definitions: FunctionDefinition[] = [
  {
    name: "http",
    handler: http_main.handle,
    events: [
      { httpApi: { route: "ANY /" } },
      { httpApi: { route: "ANY /{pathname+}" } },
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
