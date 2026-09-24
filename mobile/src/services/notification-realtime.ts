import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api/client';
import { homeApi } from './api/home';
import { getSession } from './api/storage';
import type { NotificationItem } from './api/types';

type NotificationListener = (notif: NotificationItem) => void;
type UnreadCountListener = (count: number) => void;

class NotificationRealtimeService {
  private socket: Socket | null = null;
  private newNotificationListeners = new Set<NotificationListener>();
  private unreadCountListeners = new Set<UnreadCountListener>();
  private currentUnreadCount = 0;
  private pollInterval: any = null;
  private appStateSubscription: any = null;
  private initialized = false;

  private decodeUserId(token: string): string | null {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4;
      const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
      // Polyfill base64 decode for React Native
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let str = '';
      let buffer = 0;
      let bits = 0;
      for (let i = 0; i < padded.length; i++) {
        const char = padded.charAt(i);
        if (char === '=') break;
        const idx = chars.indexOf(char);
        if (idx === -1) continue;
        buffer = (buffer << 6) | idx;
        bits += 6;
        if (bits >= 8) {
          bits -= 8;
          str += String.fromCharCode((buffer >> bits) & 0xff);
        }
      }
      const json = JSON.parse(decodeURIComponent(escape(str)));
      return json?.sub ?? json?.id ?? null;
    } catch {
      return null;
    }
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    await this.connectSocket();
    await this.refreshUnreadCount();

    // AppState listener: refresh on foreground
    this.appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        this.refreshUnreadCount().catch(() => null);
        if (!this.socket?.connected) {
          this.connectSocket().catch(() => null);
        }
      }
    });

    // Background poll fallback every 20 seconds
    this.pollInterval = setInterval(() => {
      this.refreshUnreadCount().catch(() => null);
    }, 20000);
  }

  async connectSocket() {
    const session = await getSession();
    const token = session?.accessToken;
    const userId = token ? this.decodeUserId(token) : null;

    if (this.socket) {
      if (this.socket.connected) {
        if (token) {
          this.socket.emit('auth', { token, userId });
        }
        return;
      }
      this.socket.disconnect();
      this.socket = null;
    }

    const serverUrl = API_URL.replace(/\/v1\/?$/, '');

    try {
      this.socket = io(`${serverUrl}/notifications`, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: { token, userId },
        query: { token: token ?? '', userId: userId ?? '' },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        if (__DEV__) {
          console.log('[NotificationRealtime] Socket connected to backend at', serverUrl);
        }
        if (token) {
          this.socket?.emit('auth', { token, userId });
        }
      });

      this.socket.on('notification:new', (payload: any) => {
        if (__DEV__) {
          console.log('[NotificationRealtime] Received realtime notification:', payload);
        }
        const item: NotificationItem = {
          id: payload.id || String(Date.now()),
          type: payload.type || 'SYSTEM',
          title: payload.title || 'Thông báo mới',
          body: payload.body || '',
          deepLink: payload.deepLink ?? null,
          imageUrl: payload.imageUrl ?? null,
          status: 'UNREAD',
          readAt: null,
          createdAt: payload.createdAt || new Date().toISOString(),
        };

        this.setUnreadCount(this.currentUnreadCount + 1);

        for (const listener of this.newNotificationListeners) {
          try {
            listener(item);
          } catch (e) {
            console.warn('[NotificationRealtime] Listener error:', e);
          }
        }
      });

      this.socket.on('notification:unread_count', (payload: { count: number }) => {
        if (typeof payload?.count === 'number') {
          this.setUnreadCount(payload.count);
        }
      });

      this.socket.on('disconnect', (reason) => {
        if (__DEV__) {
          console.log('[NotificationRealtime] Socket disconnected:', reason);
        }
      });

      this.socket.on('connect_error', (err) => {
        if (__DEV__) {
          console.warn('[NotificationRealtime] Connection error:', err.message);
        }
      });
    } catch (err: any) {
      if (__DEV__) {
        console.warn('[NotificationRealtime] Init socket error:', err.message);
      }
    }
  }

  async refreshUnreadCount(): Promise<number> {
    try {
      const res = await homeApi.getUnreadCount();
      const count = res?.count ?? 0;
      this.setUnreadCount(count);
      return count;
    } catch {
      return this.currentUnreadCount;
    }
  }

  getUnreadCount(): number {
    return this.currentUnreadCount;
  }

  setUnreadCount(count: number) {
    const nextCount = Math.max(0, count);
    if (this.currentUnreadCount !== nextCount) {
      this.currentUnreadCount = nextCount;
      for (const listener of this.unreadCountListeners) {
        try {
          listener(nextCount);
        } catch {
          // ignore
        }
      }
    }
  }

  subscribeToNewNotifications(listener: NotificationListener): () => void {
    this.newNotificationListeners.add(listener);
    return () => {
      this.newNotificationListeners.delete(listener);
    };
  }

  subscribeToUnreadCount(listener: UnreadCountListener): () => void {
    this.unreadCountListeners.add(listener);
    // Emit current value immediately
    listener(this.currentUnreadCount);
    return () => {
      this.unreadCountListeners.delete(listener);
    };
  }

  destroy() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.newNotificationListeners.clear();
    this.unreadCountListeners.clear();
    this.initialized = false;
  }
}

export const notificationRealtime = new NotificationRealtimeService();
