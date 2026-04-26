const fs = require('fs');
const path = require('path');

const root = process.cwd();
const courseRoot = path.join(root, 'Coursecontents');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function write(p, c) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c, 'utf8');
}

const pagesDir = path.join(root, 'css', 'pages');
fs.mkdirSync(pagesDir, { recursive: true });

const rootEntries = fs.readdirSync(root, { withFileTypes: true });
const majorCss = rootEntries
  .filter((e) => e.isFile() && e.name.endsWith('.styles.css'))
  .map((e) => e.name);

for (const file of majorCss) {
  const from = path.join(root, file);
  const to = path.join(pagesDir, file);
  fs.renameSync(from, to);
}

const rootHtml = rootEntries
  .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.html'))
  .map((e) => path.join(root, e.name));

for (const htmlPath of rootHtml) {
  let html = read(htmlPath);
  html = html.replace(/href=(['"])([^'"/]+\.styles\.css)\1/g, 'href="css/pages/$2"');
  write(htmlPath, html);
}

let combinedFolders = 0;
if (fs.existsSync(courseRoot)) {
  const items = fs.readdirSync(courseRoot, { withFileTypes: true });
  for (const item of items) {
    if (!item.isDirectory()) continue;

    const dir = path.join(courseRoot, item.name);
    const files = fs.readdirSync(dir);

    const weekCss = files
      .filter((f) => /^W\d+\.styles\.css$/i.test(f))
      .sort((a, b) => {
        const an = parseInt(a.match(/^W(\d+)/i)[1], 10);
        const bn = parseInt(b.match(/^W(\d+)/i)[1], 10);
        return an - bn;
      });

    if (weekCss.length === 0) continue;

    const combined = [];
    combined.push('/* Combined weekly styles for ' + item.name + ' */');
    for (const cssFile of weekCss) {
      const cssPath = path.join(dir, cssFile);
      combined.push('');
      combined.push('/* Source: ' + cssFile + ' */');
      combined.push('');
      combined.push(read(cssPath).trim());
    }

    write(path.join(dir, 'course.styles.css'), combined.join('\n'));

    const htmlFiles = files.filter((f) => /^W\d+\.html$/i.test(f));
    for (const htmlFile of htmlFiles) {
      const htmlPath = path.join(dir, htmlFile);
      let html = read(htmlPath);
      html = html.replace(/href=(['"])W\d+\.styles\.css\1/gi, 'href="course.styles.css"');
      write(htmlPath, html);
    }

    for (const cssFile of weekCss) {
      fs.unlinkSync(path.join(dir, cssFile));
    }

    combinedFolders += 1;
  }
}

console.log('Moved major page styles: ' + majorCss.length);
console.log('Combined weekly styles in folders: ' + combinedFolders);
