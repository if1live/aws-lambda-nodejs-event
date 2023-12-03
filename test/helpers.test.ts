import assert from "node:assert";
import { describe, it } from "node:test";
import { extractAccountIdFromFunctionArn } from "../src/helpers.js";

describe("extractAccountIdFromFunctionArn", () => {
  it("ok", () => {
    const arn = "arn :aws:lambda:ap-northeast-1:123456789012:function:hello";
    const expected = "123456789012";
    const actual = extractAccountIdFromFunctionArn(arn);
    assert.equal(actual, expected);
  });
});
