"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const blogController_1 = require("../controllers/blogController");
const router = express_1.default.Router();
// CRUD routes
router.post("/", blogController_1.createBlog); // user/agent can post draft
router.get("/", blogController_1.getBlogs); // public published blogs
router.get("/:id", blogController_1.getBlog); // single blog
router.put("/:id", blogController_1.updateBlog); // author/admin update
router.delete("/:id", blogController_1.deleteBlog); // author/admin delete
router.put("/:id/publish", blogController_1.publishBlog); // admin publish
exports.default = router;
