import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';

const HOST = 'jiediango.pro';
const KEY = '9341dee52ac0a7595be9ab4134dc3aba';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const DIST_DIR = path.resolve('dist');
const CACHE_FILE = path.resolve('.indexnow-cache.json');
const SITEMAP_FILE = path.join(DIST_DIR, 'sitemap-0.xml');

// Helper for HTTPS requests
function httpRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.setTimeout(15000);
    if (data) req.write(data);
    req.end();
  });
}

// 1. Verify key file on live HTTPS
async function checkLiveKey() {
  process.stdout.write(`🔍 正在验证线上验证文件是否生效: ${KEY_LOCATION} ... `);
  try {
    const res = await httpRequest({
      hostname: HOST,
      path: `/${KEY}.txt`,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 IndexNow-Verifier/1.0' }
    });
    const content = res.body.trim();
    if (res.statusCode === 200 && content === KEY) {
      console.log('✅ 成功 (HTTP 200, Key 匹配)');
      return { live: true, statusCode: res.statusCode };
    } else {
      console.log(`⚠️ 未就绪 (HTTP ${res.statusCode}, 内容: "${content}")`);
      return { live: false, statusCode: res.statusCode, content };
    }
  } catch (err) {
    console.log(`⚠️ 请求失败 (${err.message})`);
    return { live: false, error: err.message };
  }
}

// 2. Compute file content hash
function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('md5').update(content).digest('hex');
}

// 3. Map URL to local HTML file
function urlToHtmlFile(url) {
  let rel = url.replace(`https://${HOST}/`, '');
  if (rel.endsWith('/')) rel = rel.slice(0, -1);
  const p1 = rel ? path.join(DIST_DIR, rel, 'index.html') : path.join(DIST_DIR, 'index.html');
  const p2 = path.join(DIST_DIR, `${rel}.html`);
  return fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : null);
}

// 4. Main Differential Detection
async function getUrlsToSubmit(args) {
  // If specific URLs passed via CLI
  const customUrls = args.filter(a => a.startsWith('http://') || a.startsWith('https://'));
  if (customUrls.length > 0) {
    console.log(`📌 检测到手动指定提交 ${customUrls.length} 个 URL。`);
    return { urls: customUrls, mode: 'manual' };
  }

  const forceAll = args.includes('--all');

  // Read Sitemap for all indexable URLs
  if (!fs.existsSync(SITEMAP_FILE)) {
    throw new Error('未找到 dist/sitemap-0.xml，请先运行 npm run build 生成构建产物。');
  }

  const sitemapContent = fs.readFileSync(SITEMAP_FILE, 'utf-8');
  const sitemapUrls = [...sitemapContent.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

  let cache = { lastSubmission: null, hashes: {} };
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch (e) {
      // ignore
    }
  }

  const changedUrls = [];
  const currentHashes = {};

  for (const url of sitemapUrls) {
    const htmlFile = urlToHtmlFile(url);
    if (!htmlFile) continue;

    const hash = getFileHash(htmlFile);
    currentHashes[url] = hash;

    if (forceAll) {
      changedUrls.push(url);
    } else {
      const prevHash = cache.hashes ? cache.hashes[url] : null;
      if (!prevHash || prevHash !== hash) {
        changedUrls.push(url);
      }
    }
  }

  return { urls: changedUrls, mode: forceAll ? 'all' : 'diff', currentHashes, cache };
}

// 5. Submit to IndexNow
async function submitToIndexNow(urls) {
  if (urls.length === 0) {
    console.log('✨ 没有需要向 Bing 提交的新增或修改 URL（增量缓存有效，避免无谓重复提交）。');
    return true;
  }

  console.log(`\n🚀 准备向 Bing IndexNow 提交 ${urls.length} 个更新 URL:`);
  urls.slice(0, 10).forEach(u => console.log(`   - ${u}`));
  if (urls.length > 10) console.log(`   ... 以及其他 ${urls.length - 10} 个 URL`);

  const payload = JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls
  });

  const endpoints = [
    { name: 'api.indexnow.org', host: 'api.indexnow.org', path: '/indexnow' },
    { name: 'www.bing.com', host: 'www.bing.com', path: '/indexnow' }
  ];

  let success = false;
  for (const ep of endpoints) {
    process.stdout.write(`\n📤 正在推送至 ${ep.name} ... `);
    try {
      const res = await httpRequest({
        hostname: ep.host,
        path: ep.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, payload);

      if (res.statusCode === 200 || res.statusCode === 202) {
        console.log(`✅ 成功 (HTTP ${res.statusCode}: ${res.statusCode === 200 ? 'OK - 已立即处理' : 'Accepted - 已接收排队'})`);
        success = true;
      } else if (res.statusCode === 403 || res.statusCode === 422) {
        console.log(`⚠️ 返回 HTTP ${res.statusCode} (Key 校验未通过，通常因为线上生产环境尚未同步部署 ${KEY}.txt 验证文件)`);
      } else {
        console.log(`⚠️ 返回 HTTP ${res.statusCode}: ${res.body || '无详细错误'}`);
      }
    } catch (err) {
      console.log(`❌ 推送失败 (${err.message})`);
    }
  }

  return success;
}

async function main() {
  const args = process.argv.slice(2);
  console.log('====================================================');
  console.log('        节点GO - Bing IndexNow 增量推送工具         ');
  console.log('====================================================\n');
  console.log(`配置域名: ${HOST}`);
  console.log(`API Key:  ${KEY}`);
  console.log(`验证文件: ${KEY_LOCATION}\n`);

  // Step 1: Verify key online
  const liveCheck = await checkLiveKey();

  // Step 2: Determine URLs to submit
  const { urls, mode, currentHashes, cache } = await getUrlsToSubmit(args);

  if (args.includes('--dry-run')) {
    console.log(`\n[DRY RUN 预演模式] 将会提交 ${urls.length} 个 URL，不执行实际网络请求。`);
    return;
  }

  // Step 3: Submit URLs
  const submitted = await submitToIndexNow(urls);

  // Step 4: Update cache if successful or if manual
  if (currentHashes && (submitted || urls.length === 0)) {
    const newCache = {
      lastSubmission: new Date().toISOString(),
      key: KEY,
      hashes: currentHashes
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(newCache, null, 2), 'utf-8');
    console.log(`\n💾 增量快照已更新至 .indexnow-cache.json`);
  }

  console.log('\n====================================================');
  if (!liveCheck.live) {
    console.log('💡 重要提示：当前线上服务器尚未部署验证文件 (HTTP 404)。');
    console.log('   请将最新的 dist.zip 部署至生产环境后，在终端执行：');
    console.log('   npm run indexnow');
    console.log('   届时 Bing 即可秒级验证 Key 并开始增量索引！');
  } else {
    console.log('🎉 IndexNow 配置与推送流程已全部完成！');
  }
}

main().catch(err => {
  console.error('\n❌ 发生异常:', err);
  process.exit(1);
});
