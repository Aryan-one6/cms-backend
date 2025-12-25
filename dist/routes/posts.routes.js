"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postsRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const posts_controller_1 = require("../controllers/posts.controller");
exports.postsRouter = (0, express_1.Router)();
// public
exports.postsRouter.get("/public/posts", posts_controller_1.publicListPosts);
exports.postsRouter.get("/public/posts/:slug", posts_controller_1.publicGetPostBySlug);
// admin
exports.postsRouter.get("/admin/posts", auth_1.requireAuth, posts_controller_1.adminListPosts);
exports.postsRouter.get("/admin/posts/:id", auth_1.requireAuth, posts_controller_1.adminGetPost);
exports.postsRouter.post("/admin/posts", auth_1.requireAuth, posts_controller_1.adminCreatePost);
exports.postsRouter.put("/admin/posts/:id", auth_1.requireAuth, posts_controller_1.adminUpdatePost);
exports.postsRouter.delete("/admin/posts/:id", auth_1.requireAuth, posts_controller_1.adminDeletePost);
exports.postsRouter.post("/admin/posts/:id/publish", auth_1.requireAuth, posts_controller_1.publishPost);
exports.postsRouter.post("/admin/posts/:id/unpublish", auth_1.requireAuth, posts_controller_1.unpublishPost);
