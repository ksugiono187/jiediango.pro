import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';

const HOST = 'jiediango.pro';
const KEY = 'ee473c074266447b8977b30a8e107de8';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const DIST_DIR = path.resolve('dist');
const CACHE_FILE = path.resolve('.indexnow-cache.json');
const LOGS_DIR = path.resolve('logs');
const LOG_FILE = path.join(LOGS_DIR, 'indexnow.log');
const SITEMAP_FILE = path.join(DIST_DIR, 'sitemap-0.xml');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function writeLog(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const line = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
  } catch (err) {
    console.error('写入日志失败:', err.message);
  }
}

// HTTPS helper
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
      reject(new Error('请求超时 (15s)'));
    });
    req.setTimeout(15000);
    if (data) req.write(data);
    req.end();
  });
}

// 1. Verify key file on live HTTPS
async function checkLiveKey() {
  process.stdout.write(`🔍 正在验证线上验证文件: ${KEY_LOCATION} ... `);
  try {
    const res = await httpRequest({
      hostname: HOST,
      path: `/${KEY}.txt`,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 IndexNow-Verifier/1.0' }
    });
    const content = res.body.trim();
    if (res.statusCode === 200 && content === KEY) {
      console.log('✅ 可正常访问 (HTTP 200, 内容匹配)');
      writeLog(`线上 Key 验证成功: HTTP 200 (${KEY_LOCATION})`);
      return { live: true, statusCode: 200 };
    } else {
      console.log(`⚠️ 当前未就绪 (HTTP ${res.statusCode}, 响应: "${content.substring(0, 60)}")`);
      writeLog(`线上 Key 暂未就绪: HTTP ${res.statusCode} (${KEY_LOCATION})`);
      return { live: false, statusCode: res.statusCode, content };
    }
  } catch (err) {
    console.log(`⚠️ 探测失败 (${err.message})`);
    writeLog(`线上 Key 探测异常: ${err.message}`);
    return { live: false, error: err.message };
  }
}

// 2. Compute file content hash
function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

// 3. Map URL to local HTML file in dist
function urlToHtmlFile(url) {
  let rel = url.replace(`https://${HOST}/`, '');
  if (rel.endsWith('/')) rel = rel.slice(0, -1);
  const p1 = rel ? path.join(DIST_DIR, rel, 'index.html') : path.join(DIST_DIR, 'index.html');
  const p2 = path.join(DIST_DIR, `${rel}.html`);
  return fs.existsSync(p1) ? p1 : (fs.existsSync(p2) ? p2 : null);
}

// 4. Fetch sitemap URLs (local dist or live)
async function getSitemapUrls() {
  if (fs.existsSync(SITEMAP_FILE)) {
    const content = fs.readFileSync(SITEMAP_FILE, 'utf-8');
    return [...content.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  }
  // Fallback to fetch from live if dist doesn't exist
  try {
    const res = await httpRequest({
      hostname: HOST,
      path: '/sitemap-0.xml',
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 IndexNow/1.0' }
    });
    if (res.statusCode === 200) {
      return [...res.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    }
  } catch (e) {
    // ignore
  }
  return [];
}

// 5. Differential detection
async function detectChanges(args) {
  // Manual URLs passed via CLI
  const customUrls = args.filter(a => a.startsWith('http://') || a.startsWith('https://'));
  if (customUrls.length > 0) {
    // Validate host
    const validUrls = customUrls.filter(u => u.startsWith(`https://${HOST}/`));
    console.log(`📌 手动指定提交 ${validUrls.length} 个规范 URL。`);
    return { urls: validUrls, added: validUrls, modified: [], deleted: [], mode: 'manual' };
  }

  const forceAll = args.includes('--all');
  const sitemapUrls = await getSitemapUrls();

  if (sitemapUrls.length === 0) {
    throw new Error('未能获取到有效的 Sitemap URL 列表，请先运行 "npm run build" 生成构建产物。');
  }

  let cache = { lastSubmission: null, key: KEY, hashes: {} };
  const isFirstRun = !fs.existsSync(CACHE_FILE);

  if (!isFirstRun) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch (e) {
      cache = { lastSubmission: null, key: KEY, hashes: {} };
    }
  }

  const added = [];
  const modified = [];
  const deleted = [];
  const currentHashes = {};

  // Check current URLs against cache
  for (const url of sitemapUrls) {
    // Must be strictly https://jiediango.pro/...
    if (!url.startsWith(`https://${HOST}/`)) continue;

    const htmlFile = urlToHtmlFile(url);
    const hash = htmlFile ? getFileHash(htmlFile) : 'no-file';
    currentHashes[url] = hash;

    if (forceAll || isFirstRun) {
      added.push(url);
    } else {
      const prevHash = cache.hashes ? cache.hashes[url] : null;
      if (!prevHash) {
        added.push(url);
      } else if (prevHash !== hash) {
        modified.push(url);
      }
    }
  }

  // Detect deleted URLs (present in cache but no longer in sitemap)
  if (!forceAll && !isFirstRun && cache.hashes) {
    for (const cachedUrl of Object.keys(cache.hashes)) {
      if (!currentHashes[cachedUrl]) {
        deleted.push(cachedUrl);
      }
    }
  }

  const allToSubmit = [...new Set([...added, ...modified, ...deleted])];
  return {
    urls: allToSubmit,
    added,
    modified,
    deleted,
    isFirstRun,
    mode: forceAll ? 'all' : (isFirstRun ? 'initial' : 'diff'),
    currentHashes,
    cache
  };
}

// 6. Submit with retry mechanism
async function submitWithRetry(urls, maxRetries = 3) {
  if (urls.length === 0) {
    console.log('✨ 增量检测结果：本次部署无新增、修改或删除的 URL。');
    console.log('   （符合官方规范：不要无条件重复提交全站 URL，已自动跳过推送）');
    writeLog('未检测到 URL 变动，跳过推送。');
    return { success: true, count: 0, skipped: true };
  }

  console.log(`\n🚀 准备向 Bing IndexNow 提交 ${urls.length} 个变更 URL:`);
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

  let overallSuccess = false;
  let finalStatus = null;

  for (const ep of endpoints) {
    let attempt = 0;
    let epSuccess = false;

    while (attempt < maxRetries && !epSuccess) {
      attempt++;
      process.stdout.write(`\n📤 推送至 ${ep.name} (尝试 ${attempt}/${maxRetries}) ... `);
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

        finalStatus = res.statusCode;
        if (res.statusCode === 200 || res.statusCode === 202) {
          const statusDesc = res.statusCode === 200 ? '200 OK (已即时处理)' : '202 Accepted (已接收排队)';
          console.log(`✅ 成功 [HTTP ${statusDesc}]`);
          writeLog(`推送成功 [${ep.name} HTTP ${res.statusCode}]: ${urls.length} 个 URL`);
          epSuccess = true;
          overallSuccess = true;
        } else if (res.statusCode === 403 || res.statusCode === 422) {
          console.log(`⚠️ HTTP ${res.statusCode}: Key 校验未通过。`);
          console.log(`   说明：线上生产环境需先完成部署该 Key 文件 (${KEY}.txt) 才能通过 Bing 校验。`);
          writeLog(`推送响应 [${ep.name} HTTP ${res.statusCode}]: Key 尚未在线生效`);
          break; // 不必重试 403
        } else {
          console.log(`⚠️ HTTP ${res.statusCode}: ${res.body || '无详细返回'}`);
          writeLog(`推送警告 [${ep.name} HTTP ${res.statusCode}]: ${res.body}`);
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`   等待 ${delay / 1000}s 后重试...`);
            await new Promise(r => setTimeout(r, delay));
          }
        }
      } catch (err) {
        console.log(`❌ 网络请求失败: ${err.message}`);
        writeLog(`推送网络异常 [${ep.name} 尝试 ${attempt}]: ${err.message}`);
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`   等待 ${delay / 1000}s 后重试...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
  }

  return { success: overallSuccess, count: urls.length, finalStatus };
}

async function main() {
  const args = process.argv.slice(2);
  console.log('====================================================');
  console.log('        节点GO - Bing IndexNow 自动接入管理工具      ');
  console.log('====================================================\n');
  console.log(`目标域名:   ${HOST}`);
  console.log(`API Key:    ${KEY}`);
  console.log(`Key 验证URL: ${KEY_LOCATION}\n`);

  writeLog('=== 开始执行 IndexNow 处理流程 ===');

  // 1. 验证 Key 文件是否存在于本地构建产物
  const localKeyInPublic = fs.existsSync(path.resolve(`public/${KEY}.txt`));
  const localKeyInDist = fs.existsSync(path.resolve(`dist/${KEY}.txt`));
  console.log(`📁 本地 public 验证文件: ${localKeyInPublic ? '✅ 存在' : '❌ 缺失'}`);
  console.log(`📁 本地 dist 构建文件:   ${localKeyInDist ? '✅ 存在' : '❌ 缺失'}`);

  // 2. 验证线上 HTTPS 访问状态
  const liveCheck = await checkLiveKey();

  // 3. 差量检测
  const changeReport = await detectChanges(args);
  console.log(`\n📊 页面变动检测报告 [模式: ${changeReport.mode}]:`);
  console.log(`   - 待提交总数: ${changeReport.urls.length}`);
  console.log(`   - 新增页面:   ${changeReport.added.length}`);
  console.log(`   - 修改页面:   ${changeReport.modified.length}`);
  console.log(`   - 删除页面:   ${changeReport.deleted.length}`);

  if (args.includes('--dry-run')) {
    console.log('\n[DRY RUN 预演模式] 不执行实际网络推送。');
    return;
  }

  // 4. 执行推送
  const result = await submitWithRetry(changeReport.urls);

  // 5. 更新本地缓存快照
  if (changeReport.currentHashes && (result.success || changeReport.urls.length === 0)) {
    const newCache = {
      lastSubmission: new Date().toISOString(),
      key: KEY,
      hashes: changeReport.currentHashes
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(newCache, null, 2), 'utf-8');
    console.log(`\n💾 页面状态快照已更新保存至 .indexnow-cache.json`);
    writeLog(`已更新本地快照文件 .indexnow-cache.json (记录 ${Object.keys(changeReport.currentHashes).length} 个规范 URL)`);
  }

  console.log('\n====================================================');
  console.log(`📝 完整提交日志已保存至: ${path.relative(process.cwd(), LOG_FILE)}`);
  if (!liveCheck.live) {
    console.log('\n💡 提示：当前线上服务器尚未同步部署新的 Key 验证文件。');
    console.log('   请将本次构建好的产物部署到 GitHub Pages / 生产环境后，');
    console.log('   在终端执行 "npm run indexnow" 或通过 GitHub Actions 即可秒级验证！');
  } else {
    console.log('\n🎉 IndexNow 官方自动接入与验证流程全部执行成功！');
  }
}

main().catch(err => {
  console.error('\n❌ 发生错误:', err);
  writeLog(`执行崩溃: ${err.message}`);
  process.exit(1);
});
