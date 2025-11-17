import axios from "axios";
import FormData from "form-data";
import { v4 as uuid } from "uuid";

export async function uploadAvatar(file: Express.Multer.File): Promise<string> {
  const endpoint = normalizeV1(process.env.APPWRITE_ENDPOINT!); // e.g. https://nyc.cloud.appwrite.io/v1
  const project = process.env.APPWRITE_PROJECT_ID!;
  const apiKey = process.env.APPWRITE_API_KEY!;
  const bucketId = process.env.APPWRITE_BUCKET_ID!;
  const fileId = uuid();

  const form = new FormData();
  form.append("fileId", fileId);
  form.append("file", file.buffer, {
    filename: file.originalname || `avatar-${fileId}`,
    contentType: file.mimetype || "application/octet-stream",
    knownLength: file.size,
  });

  const res = await axios.post(
    `${endpoint}/storage/buckets/${bucketId}/files`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        "X-Appwrite-Project": project,
        "X-Appwrite-Key": apiKey,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );

  return res.data.$id;
}

function normalizeV1(url: string) {
  return url.endsWith("/v1") ? url : url.replace(/\/$/, "") + "/v1";
}
