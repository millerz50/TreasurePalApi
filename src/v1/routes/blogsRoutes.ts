import express from "express";
import {
  createBlog,
  deleteBlog,
  getBlog,
  getBlogs,
  publishBlog,
  updateBlog,
} from "../controllers/blogController";

const router = express.Router();

// CRUD routes
router.post("/", createBlog); // user/agent can post draft
router.get("/", getBlogs); // public published blogs
router.get("/:id", getBlog); // single blog
router.put("/:id", updateBlog); // author/admin update
router.delete("/:id", deleteBlog); // author/admin delete
router.put("/:id/publish", publishBlog); // admin publish

export default router;
