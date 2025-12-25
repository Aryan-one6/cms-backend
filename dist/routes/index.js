"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const auth_routes_1 = require("./auth.routes");
const posts_routes_1 = require("./posts.routes");
exports.apiRouter = (0, express_1.Router)();
exports.apiRouter.use("/auth", auth_routes_1.authRouter);
exports.apiRouter.use("/", posts_routes_1.postsRouter);
