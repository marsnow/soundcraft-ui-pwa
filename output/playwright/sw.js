'use strict';

const cacheName = 'mixer-tabs-shell-v2';
const shellPaths = ['./index.html', './embed-check.html', './app.css', './app.js', './manifest.webmanifest', './icons/soundcraft-ui-192.png', './icons/soundcraft-ui-512.png'];
const shellUrls = new Set(shellPaths.map(path => new URL(path, self.location).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shellPaths)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  // Cache only the local app shell; mixer pages and their live traffic stay on the network.
  if (event.request.method !== 'GET' || !shellUrls.has(event.request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});
