import { FunctionDefinition, standalone } from "serverless-standalone";
import * as Handlers from "./handlers.js";

const definitions: FunctionDefinition[] = [
  {
    name: "http",
    handler: Handlers.http,
    events: [
      { httpApi: { route: "ANY /" } },
      { httpApi: { route: "ANY /{pathname+}" } },
    ],
  },
];

const options = {
  httpApi: { port: 3000 },
};

const inst = standalone({
  ...options,
  functions: definitions,
});
await inst.start();
console.log("standalone", options);
