import { describe, expect, it } from "vitest";
import {
  EMPTY_SHA256,
  amzDate,
  presignUrl,
  sha256Hex,
  signRequest,
  uriEncode,
} from "@core/files/infrastructure/sigv4.js";

/**
 * The hand-rolled SigV4 signer, checked against AWS's own published Signature
 * Version 4 example for a presigned S3 GET. If any step of
 * canonical-request → string-to-sign → signing-key → signature drifts, this
 * fixed vector breaks. No network, no credentials that mean anything.
 *
 * Source: AWS docs, "Signature Calculations for the Authorization Header:
 * Transferring Payload in a Single Chunk" / the GET-object query-string example.
 */
const AWS_EXAMPLE = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
  host: "examplebucket.s3.amazonaws.com",
  key: "/test.txt",
  date: new Date("2013-05-24T00:00:00Z"),
  expectedSignature: "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404",
};

describe("sigv4 helpers", () => {
  it("amzDate splits an instant into the amz timestamp and date stamp", () => {
    expect(amzDate(new Date("2013-05-24T00:00:00Z"))).toEqual({
      amzDate: "20130524T000000Z",
      dateStamp: "20130524",
    });
  });

  it("sha256Hex matches the known hash of the empty string", () => {
    expect(sha256Hex("")).toBe(EMPTY_SHA256);
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("uriEncode is RFC 3986 (unreserved pass through, everything else percent-encoded)", () => {
    expect(uriEncode("a-b_c.d~e")).toBe("a-b_c.d~e");
    expect(uriEncode("a/b c+d")).toBe("a%2Fb%20c%2Bd");
    expect(uriEncode("a/b c+d", false)).toBe("a/b%20c%2Bd");
  });
});

describe("presignUrl — AWS Signature Version 4 known-answer vector", () => {
  it("reproduces the reference presigned GET signature exactly", () => {
    const url = presignUrl({
      method: "GET",
      host: AWS_EXAMPLE.host,
      path: AWS_EXAMPLE.key,
      service: "s3",
      region: AWS_EXAMPLE.region,
      accessKeyId: AWS_EXAMPLE.accessKeyId,
      secretAccessKey: AWS_EXAMPLE.secretAccessKey,
      expiresIn: 86_400,
      now: AWS_EXAMPLE.date,
    });

    const params = new URL(url).searchParams;
    expect(params.get("X-Amz-Signature")).toBe(AWS_EXAMPLE.expectedSignature);
    expect(params.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(params.get("X-Amz-Credential")).toBe(
      `${AWS_EXAMPLE.accessKeyId}/20130524/us-east-1/s3/aws4_request`,
    );
    expect(params.get("X-Amz-Date")).toBe("20130524T000000Z");
    expect(params.get("X-Amz-Expires")).toBe("86400");
    expect(params.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.startsWith("https://examplebucket.s3.amazonaws.com/test.txt?")).toBe(true);
  });

  it("is deterministic and key-specific", () => {
    const base = {
      method: "PUT" as const,
      host: "acc.r2.cloudflarestorage.com",
      service: "s3",
      region: "auto",
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "secret",
      expiresIn: 900,
      now: new Date("2026-09-08T12:00:00Z"),
    };
    const a1 = presignUrl({ ...base, path: "/bucket/a" });
    const a2 = presignUrl({ ...base, path: "/bucket/a" });
    const b = presignUrl({ ...base, path: "/bucket/b" });
    expect(a1).toBe(a2);
    expect(new URL(a1).searchParams.get("X-Amz-Signature")).not.toBe(
      new URL(b).searchParams.get("X-Amz-Signature"),
    );
  });
});

describe("signRequest — Authorization-header signing", () => {
  const opts = {
    method: "PUT",
    host: "acct123.r2.cloudflarestorage.com",
    path: "/mizan-files/org_1/2026/09/file_abc",
    service: "s3",
    region: "auto",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    now: new Date("2026-09-08T12:34:56Z"),
  };

  it("produces a well-formed, deterministic SigV4 Authorization header", () => {
    const signed = signRequest({ ...opts, payloadHash: sha256Hex("hello r2") });
    expect(signed.url).toBe(
      "https://acct123.r2.cloudflarestorage.com/mizan-files/org_1/2026/09/file_abc",
    );
    expect(signed.headers["x-amz-date"]).toBe("20260908T123456Z");
    expect(signed.headers["x-amz-content-sha256"]).toBe(sha256Hex("hello r2"));
    expect(signed.headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260908/auto/s3/aws4_request, " +
        "SignedHeaders=host;x-amz-content-sha256;x-amz-date, " +
        "Signature=114690bdd40366a7d338c3f3655ce6ac44d208a4056d368d4ddb13068f14a332",
    );
  });

  it("defaults the payload hash to the empty-string hash for bodyless requests", () => {
    const signed = signRequest({ ...opts, method: "HEAD" });
    expect(signed.headers["x-amz-content-sha256"]).toBe(EMPTY_SHA256);
    expect(signed.headers.authorization).toContain(
      "Signature=9c1599f998075216b180c2336c8ecc2250b788564f56801fca3f0c63cf43441e",
    );
  });
});
