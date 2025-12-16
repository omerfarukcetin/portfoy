const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'dist', 'index.html');
const html404Path = path.join(__dirname, 'dist', '404.html');

// Read index.html
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Replace absolute paths with relative paths
indexHtml = indexHtml.replace(/src="\/(_expo\/[^"]+)"/g, 'src="./$1"');
indexHtml = indexHtml.replace(/href="\/([^"]+)"/g, 'href="./$1"');

// Write back
fs.writeFileSync(indexPath, indexHtml);
console.log('✅ Fixed paths in index.html');

// Also fix 404.html
if (fs.existsSync(html404Path)) {
    let html404 = fs.readFileSync(html404Path, 'utf8');
    html404 = html404.replace(/src="\/(_expo\/[^"]+)"/g, 'src="./$1"');
    html404 = html404.replace(/href="\/([^"]+)"/g, 'href="./$1"');
    fs.writeFileSync(html404Path, html404);
    console.log('✅ Fixed paths in 404.html');
}
