const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

async function startServer() {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const filename = path.resolve(__dirname, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!filename.startsWith(__dirname + path.sep)) throw new Error('Outside app');
      const body = await readFile(filename);
      response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/embed-check.html` };
}

module.exports = { startServer };
