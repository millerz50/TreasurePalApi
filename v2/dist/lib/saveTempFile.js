"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTempFile = saveTempFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const writeFile = (0, util_1.promisify)(fs_1.default.writeFile);
async function saveTempFile(buffer, filename) {
    const tempDir = path_1.default.join(__dirname, "..", "temp");
    if (!fs_1.default.existsSync(tempDir))
        fs_1.default.mkdirSync(tempDir, { recursive: true });
    const tempPath = path_1.default.join(tempDir, `${Date.now()}-${filename}`);
    await writeFile(tempPath, buffer);
    return tempPath;
}
