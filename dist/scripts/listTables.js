"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tables = exports.databases = exports.appwrite = void 0;
exports.createDatabasesFromClient = createDatabasesFromClient;
exports.createTablesFromClient = createTablesFromClient;
// server/appwrite/appwriteConfig.ts
const dotenv_1 = __importDefault(require("dotenv"));
const node_appwrite_1 = require("node-appwrite");
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), ".env"), override: true });
const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY } = process.env;
if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    throw new Error("Missing one of APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY in environment");
}
const normalizedEndpoint = APPWRITE_ENDPOINT.endsWith("/v1")
    ? APPWRITE_ENDPOINT
    : APPWRITE_ENDPOINT.replace(/\/$/, "") + "/v1";
exports.appwrite = new node_appwrite_1.Client()
    .setEndpoint(normalizedEndpoint)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY)
    .setSelfSigned(true); // dev only
// export a Databases client (document DB compatibility)
exports.databases = new node_appwrite_1.Databases(exports.appwrite);
// export a TablesDB client (relational-style tables API)
exports.tables = new node_appwrite_1.TablesDB(exports.appwrite);
// factory helpers if you ever need a client created from a different Client
function createDatabasesFromClient(c) {
    return new node_appwrite_1.Databases(c);
}
function createTablesFromClient(c) {
    return new node_appwrite_1.TablesDB(c);
}
