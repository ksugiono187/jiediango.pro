import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    author: z.string().optional()
  })
});

const brands = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/brands" }),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    updatedDate: z.date().optional(),
    url: z.string().optional(),
    price: z.string().optional(),
    rating: z.string().optional(),
    recommendReason: z.string().optional()
  })
});

const topics = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/topics" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    featured: z.boolean().default(false),
    updatedDate: z.date().optional()
  })
});

const articles = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    author: z.string().default('小编'),
    category: z.string().optional(),
    coverImage: z.string().optional()
  })
});

export const collections = {
  blog,
  brands,
  topics,
  articles
};
