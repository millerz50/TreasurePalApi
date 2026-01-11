"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USERS_TABLE = exports.PROPERTIES_TABLE = exports.DB_ID = exports.storage = exports.tablesDB = void 0;
const node_appwrite_1 = require("node-appwrite");
const client = new node_appwrite_1.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
exports.tablesDB = new node_appwrite_1.TablesDB(client);
exports.storage = new node_appwrite_1.Storage(client);
exports.DB_ID = process.env.APPWRITE_DATABASE_ID;
exports.PROPERTIES_TABLE = "properties";
exports.USERS_TABLE = process.env.APPWRITE_USERTABLE_ID;
