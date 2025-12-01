"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBlog = createBlog;
exports.getBlogs = getBlogs;
exports.getBlog = getBlog;
exports.updateBlog = updateBlog;
exports.deleteBlog = deleteBlog;
exports.publishBlog = publishBlog;
const blogService = __importStar(require("../services/blogService"));
async function createBlog(req, res) {
    try {
        const { title, content } = req.body;
        const user = req.user;
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
            authorRole: user.role,
        });
        res.status(201).json(blog);
    }
    catch (err) {
        res.status(500).json({ error: "Failed to create blog" });
    }
}
async function getBlogs(req, res) {
    try {
        const blogs = await blogService.getPublishedBlogs();
        res.json(blogs);
    }
    catch (err) {
        res.status(500).json({ error: "Failed to fetch blogs" });
    }
}
async function getBlog(req, res) {
    try {
        const blog = await blogService.getBlogById(req.params.id);
        res.json(blog);
    }
    catch {
        res.status(404).json({ error: "Blog not found" });
    }
}
async function updateBlog(req, res) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const blog = await blogService.getBlogById(req.params.id);
        if (blog.authorId !== user.id && user.role !== "admin") {
            return res.status(403).json({ error: "Not allowed" });
        }
        const updated = await blogService.updateBlog(req.params.id, req.body);
        res.json(updated);
    }
    catch {
        res.status(500).json({ error: "Failed to update blog" });
    }
}
async function deleteBlog(req, res) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const blog = await blogService.getBlogById(req.params.id);
        if (blog.authorId !== user.id && user.role !== "admin") {
            return res.status(403).json({ error: "Not allowed" });
        }
        await blogService.deleteBlog(req.params.id);
        res.json({ success: true });
    }
    catch {
        res.status(500).json({ error: "Failed to delete blog" });
    }
}
async function publishBlog(req, res) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (user.role !== "admin") {
            return res.status(403).json({ error: "Only admin can publish" });
        }
        const published = await blogService.publishBlog(req.params.id);
        res.json(published);
    }
    catch {
        res.status(500).json({ error: "Failed to publish blog" });
    }
}
