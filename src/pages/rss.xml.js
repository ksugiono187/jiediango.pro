import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site } from '../data/site';

export async function GET(context) {
  const articles = await getCollection('articles');
  
  return rss({
    title: site.name,
    description: site.description,
    site: context.site || site.domain,
    items: articles.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/articles/${post.slug}/`,
    })),
    customData: `<language>${site.defaultLanguage}</language>`,
  });
}
