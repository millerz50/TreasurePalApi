"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tables = exports.storage = exports.appwrite = void 0;
const node_appwrite_1 = require("node-appwrite");
const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY } = process.env;
if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    throw new Error("Missing Appwrite environment variables");
}
exports.appwrite = new node_appwrite_1.Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);
exports.storage = new node_appwrite_1.Storage(exports.appwrite);
exports.tables = new node_appwrite_1.TablesDB(exports.appwrite);
