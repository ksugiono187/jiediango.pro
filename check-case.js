import fs from 'fs';
import path from 'path';

function checkDirectory(dir) {
    let hasError = false;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (checkDirectory(fullPath)) hasError = true;
        } else if (fullPath.endsWith('.astro') || fullPath.endsWith('.js') || fullPath.endsWith('.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                const importPath = match[1];
                if (importPath.startsWith('.')) {
                    const absoluteImportPath = path.resolve(dir, importPath);
                    // Check if file exists exactly with this casing
                    const dirName = path.dirname(absoluteImportPath);
                    const baseName = path.basename(absoluteImportPath);
                    if (fs.existsSync(dirName)) {
                        const actualFiles = fs.readdirSync(dirName);
                        // find exact match
                        const exactMatch = actualFiles.find(f => f === baseName || f.startsWith(baseName + '.'));
                        const lowerMatch = actualFiles.find(f => f.toLowerCase() === baseName.toLowerCase() || f.toLowerCase().startsWith(baseName.toLowerCase() + '.'));
                        if (!exactMatch && lowerMatch) {
                            console.error(`Case mismatch in ${fullPath}: imported '${importPath}', but actual file is '${lowerMatch}'`);
                            hasError = true;
                        }
                    }
                }
            }
        }
    }
    return hasError;
}

const hasError = checkDirectory('./src');
if (hasError) process.exit(1);
console.log('All imports have correct casing.');
