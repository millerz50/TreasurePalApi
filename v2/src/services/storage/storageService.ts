import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";

function normalizeEndpoint(endpoint?: string) {
  if (!endpoint) throw new Error("APPWRITE_ENDPOINT not set");
  return endpoint.endsWith("/v1")
    ? endpoint.replace(/\/$/, "")
    : endpoint.replace(/\/$/, "") + "/v1";
}

export async function uploadToAppwriteBucket(
  buffer: Buffer,
  originalName?: string
) {
  const endpointRaw = process.env.APPWRITE_ENDPOINT!;
  const endpoint = endpointRaw.endsWith("/v1")
    ? endpointRaw
    : endpointRaw.replace(/\/$/, "") + "/v1";
  const project = process.env.APPWRITE_PROJECT_ID!;
  const apiKey = process.env.APPWRITE_API_KEY!;
  const bucketId = process.env.APPWRITE_BUCKET_ID!;

  if (!project || !apiKey || !bucketId)
    throw new Error("Missing Appwrite env vars");

  const fileId = `file-${uuid()}`;
  const filename = originalName || fileId;

  const tmpDir = path.join(process.cwd(), "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
  const tempPath = path.join(tmpDir, `${fileId}-${filename}`);
  fs.writeFileSync(tempPath, buffer);

  const form = new FormData();
  form.append("fileId", fileId);
  // toggle public read quickly for verification; remove for private files
  form.append("read[]", "role:all");
  form.append("file", fs.createReadStream(tempPath), { filename });

  const url = `${endpoint}/storage/buckets/${bucketId}/files`;

  try {
    const res = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        "X-Appwrite-Project": project,
        "X-Appwrite-Key": apiKey,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const returnedId = res.data.$id;
    const viewUrl = `${endpoint}/storage/buckets/${bucketId}/files/${returnedId}/view?project=${project}`;
    return { fileId: returnedId, url: viewUrl, raw: res.data };
  } catch (err: any) {
    const errBody = err?.response?.data ?? err.message;
    throw new Error(`Appwrite upload failed: ${JSON.stringify(errBody)}`);
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch {}
  }
}
