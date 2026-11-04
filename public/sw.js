self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => { let data={}; try { data=e.data?.json() || {}; } catch {} e.waitUntil(self.registration.showNotification(data.title || 'Recall reminder', {body:data.body || 'You have a follow-up due.', icon:'/icon.svg', badge:'/icon.svg', tag:data.tag || 'recall-reminder', data:{url:data.url || '/'}})); });
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(self.clients.openWindow(e.notification.data?.url || '/')); });
