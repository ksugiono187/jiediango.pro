const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function parseFrontmatter(content) {
    const titleMatch = content.match(/title:\s*["']?([^"'\n]+)["']?/);
    const descMatch = content.match(/description:\s*["']?([^"'\n]+)["']?/);
    const kwMatch = content.match(/keywords:\s*\[(.*?)\]|keywords:\s*["']?([^"'\n]+)["']?/);
    
    return {
        title: titleMatch ? titleMatch[1] : '',
        description: descMatch ? descMatch[1] : '',
        keywords: kwMatch ? (kwMatch[1] || kwMatch[2]) : ''
    };
}

function parseAstroProps(content) {
    const titleMatch = content.match(/title=["']([^"']+)["']/);
    const descMatch = content.match(/description=["']([^"']+)["']/);
    const kwMatch = content.match(/keywords=["']([^"']+)["']/);
    
    return {
        title: titleMatch ? titleMatch[1] : '',
        description: descMatch ? descMatch[1] : '',
        keywords: kwMatch ? kwMatch[1] : ''
    };
}

const results = [];

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            scanDirectory(fullPath);
        } else if (file.endsWith('.md') || file.endsWith('.astro')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const relPath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
            
            let tdk = { title: '', description: '', keywords: '' };
            if (file.endsWith('.md')) {
                tdk = parseFrontmatter(content);
            } else if (file.endsWith('.astro')) {
                tdk = parseAstroProps(content);
            }
            
            if (tdk.title || tdk.description || tdk.keywords) {
                results.push({ file: relPath, ...tdk });
            }
        }
    }
}

scanDirectory(path.join(srcDir, 'pages'));
scanDirectory(path.join(srcDir, 'content'));

console.log(JSON.stringify(results, null, 2));
