"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminListPosts = adminListPosts;
exports.adminGetPost = adminGetPost;
exports.adminCreatePost = adminCreatePost;
exports.adminUpdatePost = adminUpdatePost;
exports.adminDeletePost = adminDeletePost;
exports.publishPost = publishPost;
exports.unpublishPost = unpublishPost;
exports.publicListPosts = publicListPosts;
exports.publicGetPostBySlug = publicGetPostBySlug;
const zod_1 = require("zod");
const slugify_1 = __importDefault(require("slugify"));
const prisma_1 = require("../config/prisma");
const createSchema = zod_1.z.object({
    title: zod_1.z.string().min(3),
    excerpt: zod_1.z.string().optional(),
    coverImageUrl: zod_1.z.string().optional(),
    contentHtml: zod_1.z.string().min(1),
    tags: zod_1.z.array(zod_1.z.string()).optional(), // tag names
});
const updateSchema = createSchema.partial();
async function ensureUniqueSlug(base) {
    let slug = (0, slugify_1.default)(base, { lower: true, strict: true });
    let i = 1;
    while (true) {
        const exists = await prisma_1.prisma.blogPost.findUnique({ where: { slug } });
        if (!exists)
            return slug;
        slug = `${(0, slugify_1.default)(base, { lower: true, strict: true })}-${i++}`;
    }
}
async function adminListPosts(req, res) {
    const posts = await prisma_1.prisma.blogPost.findMany({
        orderBy: { updatedAt: "desc" },
        include: { author: { select: { id: true, name: true } }, tags: { include: { tag: true } } },
    });
    res.json({ posts });
}
async function adminGetPost(req, res) {
    const post = await prisma_1.prisma.blogPost.findUnique({
        where: { id: req.params.id },
        include: { tags: { include: { tag: true } }, author: { select: { id: true, name: true } } },
    });
    if (!post)
        return res.status(404).json({ message: "Not found" });
    res.json({ post });
}
async function adminCreatePost(req, res) {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    const auth = req.auth;
    const slug = await ensureUniqueSlug(parsed.data.title);
    const post = await prisma_1.prisma.blogPost.create({
        data: {
            title: parsed.data.title,
            slug,
            excerpt: parsed.data.excerpt,
            coverImageUrl: parsed.data.coverImageUrl,
            contentHtml: parsed.data.contentHtml,
            authorId: auth.adminId,
        },
    });
    // tags
    if (parsed.data.tags?.length) {
        for (const t of parsed.data.tags) {
            const tagSlug = (0, slugify_1.default)(t, { lower: true, strict: true });
            const tag = await prisma_1.prisma.tag.upsert({
                where: { slug: tagSlug },
                update: { name: t },
                create: { name: t, slug: tagSlug },
            });
            await prisma_1.prisma.blogPostTag.create({ data: { postId: post.id, tagId: tag.id } });
        }
    }
    res.status(201).json({ post });
}
async function adminUpdatePost(req, res) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json(parsed.error.flatten());
    const existing = await prisma_1.prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!existing)
        return res.status(404).json({ message: "Not found" });
    const post = await prisma_1.prisma.blogPost.update({
        where: { id: req.params.id },
        data: {
            title: parsed.data.title ?? undefined,
            excerpt: parsed.data.excerpt ?? undefined,
            coverImageUrl: parsed.data.coverImageUrl ?? undefined,
            contentHtml: parsed.data.contentHtml ?? undefined,
        },
    });
    // replace tags if provided
    if (parsed.data.tags) {
        await prisma_1.prisma.blogPostTag.deleteMany({ where: { postId: post.id } });
        for (const t of parsed.data.tags) {
            const tagSlug = (0, slugify_1.default)(t, { lower: true, strict: true });
            const tag = await prisma_1.prisma.tag.upsert({
                where: { slug: tagSlug },
                update: { name: t },
                create: { name: t, slug: tagSlug },
            });
            await prisma_1.prisma.blogPostTag.create({ data: { postId: post.id, tagId: tag.id } });
        }
    }
    res.json({ post });
}
async function adminDeletePost(req, res) {
    await prisma_1.prisma.blogPost.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
}
async function publishPost(req, res) {
    const post = await prisma_1.prisma.blogPost.update({
        where: { id: req.params.id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    res.json({ post });
}
async function unpublishPost(req, res) {
    const post = await prisma_1.prisma.blogPost.update({
        where: { id: req.params.id },
        data: { status: "DRAFT", publishedAt: null },
    });
    res.json({ post });
}
// PUBLIC
async function publicListPosts(req, res) {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
    const search = String(req.query.search || "").trim();
    const tag = String(req.query.tag || "").trim();
    const where = {
        status: "PUBLISHED",
    };
    if (search) {
        where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { excerpt: { contains: search, mode: "insensitive" } },
        ];
    }
    if (tag) {
        where.tags = {
            some: { tag: { slug: tag } },
        };
    }
    const [total, posts] = await Promise.all([
        prisma_1.prisma.blogPost.count({ where }),
        prisma_1.prisma.blogPost.findMany({
            where,
            orderBy: { publishedAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                title: true,
                slug: true,
                excerpt: true,
                coverImageUrl: true,
                publishedAt: true,
                tags: { select: { tag: { select: { name: true, slug: true } } } },
            },
        }),
    ]);
    res.json({ page, limit, total, posts });
}
async function publicGetPostBySlug(req, res) {
    const post = await prisma_1.prisma.blogPost.findFirst({
        where: { slug: req.params.slug, status: "PUBLISHED" },
        select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            coverImageUrl: true,
            contentHtml: true,
            publishedAt: true,
            tags: { select: { tag: { select: { name: true, slug: true } } } },
        },
    });
    if (!post)
        return res.status(404).json({ message: "Not found" });
    res.json({ post });
}
