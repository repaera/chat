// src/lib/storage.ts
import "server-only";

import { S3Client, DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

// R2 uses an S3-compatible API with a per-account endpoint.
// Docs: https://developers.cloudflare.com/r2/api/s3/api/
const R2_ENDPOINT = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Singleton — one client for the entire Node.js process
let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials tidak lengkap. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, dan R2_SECRET_ACCESS_KEY."
    );
  }

  _client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId, secretAccessKey },
  });

  return _client;
}

const BUCKET = () => {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME tidak diset.");
  return bucket;
};

const PUBLIC_URL = () => {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) throw new Error("R2_PUBLIC_URL tidak diset.");
  return url.replace(/\/$/, ""); // remove trailing slash
};

// ── Upload ────────────────────────────────────────────────────
export async function uploadToR2(params: {
  key: string;
  body: Buffer | Uint8Array | Blob;
  contentType: string;
}): Promise<string> {
  const upload = new Upload({
    client: getClient(),
    params: {
      Bucket: BUCKET(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    },
  });

  await upload.done();
  return `${PUBLIC_URL()}/${params.key}`;
}

// ── Delete single object ──────────────────────────────────────
export async function deleteFromR2(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: BUCKET(), Key: key })
  );
}

// ── Delete many objects at once (max 1000 per call) ───────────
export async function deleteManyFromR2(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  // S3 DeleteObjects max 1000 per request — chunk if more
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += 1000) {
    chunks.push(keys.slice(i, i + 1000));
  }

  await Promise.all(
    chunks.map((chunk) =>
      getClient().send(
        new DeleteObjectsCommand({
          Bucket: BUCKET(),
          Delete: {
            Objects: chunk.map((key) => ({ Key: key })),
            Quiet: true, // only return errors, not success list
          },
        })
      )
    )
  );
}

// ── Check if R2 env vars are available ─────────────────────────
export function isStorageConfigured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );
}
