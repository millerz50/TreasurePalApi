import { Request, Response } from "express";
import * as blogService from "../services/blogService";

export async function createBlog(req: Request, res: Response) {
  try {
    const { title, content } = req.body;
    const user = req.authUser; // ✅ use authUser

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content required" });
    }
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const blog = await blogService.createBlog({
      title,
      content,
      authorId: user.id,
      authorRole: user.role, // already typed as "admin" | "agent" | "user"
    });

    res.status(201).json(blog);
  } catch (err) {
    res.status(500).json({ error: "Failed to create blog" });
  }
}

export async function getBlogs(_req: Request, res: Response) {
  try {
    const blogs = await blogService.getPublishedBlogs();
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch blogs" });
  }
}

export async function getBlog(req: Request, res: Response) {
  try {
    const blog = await blogService.getBlogById(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }
    res.json(blog);
  } catch {
    res.status(404).json({ error: "Blog not found" });
  }
}

export async function updateBlog(req: Request, res: Response) {
  try {
    const user = req.authUser; // ✅ use authUser
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const blog = await blogService.getBlogById(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    if (blog.authorId !== user.id && user.role !== "admin") {
      return res.status(403).json({ error: "Not allowed" });
    }

    const updated = await blogService.updateBlog(req.params.id, req.body);
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update blog" });
  }
}

export async function deleteBlog(req: Request, res: Response) {
  try {
    const user = req.authUser; // ✅ use authUser
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const blog = await blogService.getBlogById(req.params.id);
    if (!blog) {
      return res.status(404).json({ error: "Blog not found" });
    }

    if (blog.authorId !== user.id && user.role !== "admin") {
      return res.status(403).json({ error: "Not allowed" });
    }

    await blogService.deleteBlog(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete blog" });
  }
}

export async function publishBlog(req: Request, res: Response) {
  try {
    const user = req.authUser; // ✅ use authUser
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Only admin can publish" });
    }

    const published = await blogService.publishBlog(req.params.id);
    res.json(published);
  } catch {
    res.status(500).json({ error: "Failed to publish blog" });
  }
}
