import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');

if (!fs.existsSync(distDir)) {
  console.error('❌ dist directory does not exist. Please run "npm run build" first.');
  process.exit(1);
}

function getAllHtmlFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllHtmlFiles(fullPath));
    } else if (file.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

const htmlFiles = getAllHtmlFiles(distDir);
console.log(`\n🔍 Found ${htmlFiles.length} HTML files in dist/ to verify.\n`);

let failedChecks = 0;
const results = [];

function recordResult(rule, status, details = []) {
  if (status === 'PASS') {
    results.push(`✅ [PASS] ${rule}`);
  } else {
    failedChecks++;
    results.push(`❌ [FAIL] ${rule}\n   ` + details.join('\n   '));
  }
}

// Data structures for verification
const pageData = new Map();
const allHrefLinks = new Set();
const duplicateTitleMap = new Map();

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const relPath = path.relative(distDir, file).replace(/\\/g, '/');
  
  // Extract Title
  const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract Meta Description
  const descMatch = content.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i);
  const description = descMatch ? descMatch[1].trim() : '';

  // Extract Canonical
  const canonicalMatch = content.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1].trim() : '';

  // Extract Noindex
  const isNoindex = /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(content);

  // Extract H1s
  const h1Matches = [...content.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1Texts = h1Matches.map(m => m[1].replace(/<[^>]+>/g, '').trim());

  // Extract internal href links
  const hrefMatches = [...content.matchAll(/href=["'](\/[^"']*)["']/gi)];
  for (const hm of hrefMatches) {
    let href = hm[1].split('#')[0].split('?')[0];
    if (href && !href.startsWith('//')) {
      allHrefLinks.add({ source: relPath, target: href });
    }
  }

  pageData.set(relPath, {
    title,
    description,
    canonical,
    isNoindex,
    h1Texts,
    is404: relPath === '404.html'
  });

  if (!isNoindex && relPath !== '404.html' && title) {
    if (!duplicateTitleMap.has(title)) {
      duplicateTitleMap.set(title, []);
    }
    duplicateTitleMap.get(title).push(relPath);
  }
}

// 1. Check Title Presence & Length
const missingTitlePages = [];
for (const [relPath, data] of pageData) {
  if (!data.title || data.title.length < 5) {
    missingTitlePages.push(`${relPath}: title missing or too short ("${data.title}")`);
  }
}
recordResult('1. 所有正式页面是否存在有效 Title', missingTitlePages.length === 0 ? 'PASS' : 'FAIL', missingTitlePages);

// 2. Check Duplicate Titles (Excluding intentional canonical duplicates if any)
const duplicateTitleIssues = [];
for (const [title, pages] of duplicateTitleMap) {
  if (pages.length > 1) {
    // Check if pages are just blog index and blog example-post
    duplicateTitleIssues.push(`Duplicate title "${title}" in: ${pages.join(', ')}`);
  }
}
recordResult('2. 正式索引页面是否存在意外重复 Title', duplicateTitleIssues.length === 0 ? 'PASS' : 'FAIL', duplicateTitleIssues);

// 3. Check Duplicate Brand Suffix
const duplicateSuffixIssues = [];
for (const [relPath, data] of pageData) {
  if (data.title.includes('节点GO - 节点GO') || data.title.includes('节点GO｜节点GO') || (data.title.match(/节点GO/g) || []).length > 2) {
    duplicateSuffixIssues.push(`${relPath}: "${data.title}"`);
  }
}
recordResult('3. 是否存在重复品牌后缀 (如 "- 节点GO - 节点GO")', duplicateSuffixIssues.length === 0 ? 'PASS' : 'FAIL', duplicateSuffixIssues);

// 4. Check Meta Description Presence
const missingDescPages = [];
for (const [relPath, data] of pageData) {
  if (!data.isNoindex && !data.is404 && (!data.description || data.description.length < 20)) {
    missingDescPages.push(`${relPath}: description missing or too short ("${data.description}")`);
  }
}
recordResult('4. 是否缺少有效 Meta Description', missingDescPages.length === 0 ? 'PASS' : 'FAIL', missingDescPages);

// 5. Check Canonical Presence & Domain
const canonicalIssues = [];
for (const [relPath, data] of pageData) {
  if (!data.is404) {
    if (!data.canonical) {
      canonicalIssues.push(`${relPath}: 缺少 canonical 标签`);
    } else if (!data.canonical.startsWith('https://jiediango.pro/')) {
      canonicalIssues.push(`${relPath}: canonical 未使用官方规范域名 (${data.canonical})`);
    }
  }
}
recordResult('5. Canonical 标签完整性与域名规范性', canonicalIssues.length === 0 ? 'PASS' : 'FAIL', canonicalIssues);

// 6. Check Unique Visible H1 for indexable content pages
const h1Issues = [];
for (const [relPath, data] of pageData) {
  if (!data.isNoindex && !data.is404) {
    if (data.h1Texts.length === 0) {
      h1Issues.push(`${relPath}: 缺少 H1 标签`);
    } else if (data.h1Texts.length > 1) {
      h1Issues.push(`${relPath}: 存在多个 H1 标签 (${data.h1Texts.length}) -> [${data.h1Texts.join(' | ')}]`);
    }
  }
}
recordResult('6. 正式内容页面是否有且仅有唯一可见 H1', h1Issues.length === 0 ? 'PASS' : 'FAIL', h1Issues);

// 7. Check Sitemap Cleanliness
const sitemapPath = path.join(distDir, 'sitemap-0.xml');
const sitemapIssues = [];
if (!fs.existsSync(sitemapPath)) {
  sitemapIssues.push('未找到 sitemap-0.xml');
} else {
  const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
  const sitemapUrls = [...sitemapContent.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

  for (const url of sitemapUrls) {
    if (url.includes('/go/')) {
      sitemapIssues.push(`Sitemap 包含 noindex 跳转页: ${url}`);
    }
    if (url.includes('/404')) {
      sitemapIssues.push(`Sitemap 包含 404 页: ${url}`);
    }
    if (!url.startsWith('https://jiediango.pro/')) {
      sitemapIssues.push(`Sitemap URL 未使用规范协议/域名: ${url}`);
    }
  }
}
recordResult('7. Sitemap 是否已排除 noindex、404 及非规范 URL', sitemapIssues.length === 0 ? 'PASS' : 'FAIL', sitemapIssues);

// 8. Check Sitemap vs Canonical Consistency
const sitemapCanonicalIssues = [];
if (fs.existsSync(sitemapPath)) {
  const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
  const sitemapUrls = [...sitemapContent.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

  for (const url of sitemapUrls) {
    // Map URL to dist HTML path
    let relPath = url.replace('https://jiediango.pro/', '');
    if (relPath.endsWith('/')) relPath = relPath.slice(0, -1);
    const candidateFile1 = relPath ? `${relPath}/index.html` : 'index.html';
    const candidateFile2 = `${relPath}.html`;
    const targetFile = fs.existsSync(path.join(distDir, candidateFile1)) ? candidateFile1 : (fs.existsSync(path.join(distDir, candidateFile2)) ? candidateFile2 : null);

    if (targetFile && pageData.has(targetFile)) {
      const page = pageData.get(targetFile);
      if (page.canonical && page.canonical !== url) {
        sitemapCanonicalIssues.push(`Sitemap URL (${url}) 与页面 Canonical (${page.canonical}) 不一致`);
      }
    }
  }
}
recordResult('8. Sitemap URL 与页面 Canonical 一致性', sitemapCanonicalIssues.length === 0 ? 'PASS' : 'FAIL', sitemapCanonicalIssues);

// 9. Internal Link Integrity (Dead link detection)
const deadLinks = [];
for (const link of allHrefLinks) {
  let targetPath = link.target;
  if (targetPath.endsWith('/')) targetPath = targetPath.slice(0, -1);
  const target1 = targetPath ? path.join(distDir, targetPath, 'index.html') : path.join(distDir, 'index.html');
  const target2 = path.join(distDir, `${targetPath}.html`);
  const targetStatic = path.join(distDir, targetPath);

  const exists = fs.existsSync(target1) || fs.existsSync(target2) || fs.existsSync(targetStatic);
  if (!exists) {
    deadLinks.push(`来源: ${link.source} -> 无效内链目标: ${link.target}`);
  }
}
recordResult('9. 内部死链检测 (Internal 404 Links)', deadLinks.length === 0 ? 'PASS' : 'FAIL', deadLinks);

// 10. Check Test/Placeholder Pages Index Configuration
const testConfigIssues = [];
for (const [relPath, data] of pageData) {
  if (relPath.startsWith('go/')) {
    if (!data.isNoindex) {
      testConfigIssues.push(`${relPath}: 跳转页未设置 noindex`);
    }
  }
}
recordResult('10. 临时跳转/测试页面的 noindex 保护配置', testConfigIssues.length === 0 ? 'PASS' : 'FAIL', testConfigIssues);

console.log('====================================================');
console.log('              SEO 自动化验收测试结果                 ');
console.log('====================================================\n');
console.log(results.join('\n\n'));
console.log('\n====================================================');
if (failedChecks === 0) {
  console.log('🎉 全部 10 项 SEO 验证规则均已通过 (100% PASS)！');
  process.exit(0);
} else {
  console.log(`⚠️ 共 ${failedChecks} 项验证未通过，请检查上方日志。`);
  process.exit(1);
}
