"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEBUG = void 0;
exports.logInfo = logInfo;
exports.logWarn = logWarn;
exports.logError = logError;
exports.logDebug = logDebug;
// server/utils/logger.ts
const util_1 = __importDefault(require("util"));
exports.DEBUG = process.env.DEBUG === "true";
function formatMessage(level, msg, meta) {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${util_1.default.inspect(meta, { depth: 3 })}` : "";
    return `${timestamp} [${level}] ${msg}${metaStr}`;
}
function logInfo(message, meta) {
    console.info(formatMessage("INFO", message, meta));
}
function logWarn(message, meta) {
    console.warn(formatMessage("WARN", message, meta));
}
function logError(context, err, meta) {
    const errMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error(formatMessage("ERROR", `${context} - ${errMsg}`, meta));
}
function logDebug(message, meta) {
    if (exports.DEBUG)
        console.debug(formatMessage("DEBUG", message, meta));
}
