import { Router } from "express";
import { TablesDB } from "node-appwrite";
import { tables as defaultTables } from "../appwrite/appwriteConfig";

const router = Router();

const DB_ID = process.env.APPWRITE_DATABASE_ID;
if (!DB_ID) {
  console.warn(
    "APPWRITE_DATABASE_ID not set — /health will report disconnected"
  );
}

router.get("/", async (_req, res) => {
  const timestamp = new Date().toISOString();

  if (!DB_ID) {
    return res.status(503).json({
      status: "error",
      db: "disconnected",
      timestamp,
      tableCount: 0,
      message: "DB id not configured",
    });
  }

  try {
    const tablesDB: TablesDB = defaultTables;
    const result = await tablesDB.listTables(DB_ID);

    return res.status(200).json({
      status: "ok",
      db: "connected",
      timestamp,
      tableCount: typeof result.total === "number" ? result.total : 0,
    });
  } catch (err: any) {
    console.error(
      "❌ TablesDB connection failed:",
      err?.message ?? err,
      err?.response ?? ""
    );
    return res.status(503).json({
      status: "error",
      db: "disconnected",
      timestamp,
      tableCount: 0,
      message: "failed to connect to TablesDB",
    });
  }
});

export default router;
