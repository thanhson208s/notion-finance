import { VercelRequest, VercelResponse } from "@vercel/node";
import { handleWorkerRequest } from "./_handlers/worker.handler";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
  
    if (req.headers["x-qstash-worker-secret"] !== process.env.QSTASH_WORKER_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  
  return handleWorkerRequest(req, res);
}
