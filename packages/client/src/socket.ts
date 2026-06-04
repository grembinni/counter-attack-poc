import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@counter-attack/shared';

/**
 * Module-singleton Socket.io client instance.
 * Generic order: Socket<ServerToClientEvents, ClientToServerEvents>
 *   — client RECEIVES ServerToClientEvents, SENDS ClientToServerEvents.
 * autoConnect: false — explicit socket.connect() is called in App.tsx mount effect (D-02).
 * transports: ['websocket'] — no polling fallback (STATE.md locked decision).
 * auth callback — reads ca_session_token from localStorage on each connection attempt
 *   to deliver reconnect session token (CONN-03).
 */
const socketUrl: string =
  (import.meta.env['VITE_SOCKET_URL'] as string | undefined) ?? 'http://localhost:3001';

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl, {
  autoConnect: false,
  transports: ['websocket'],
  auth: (cb: (data: { sessionToken?: string }) => void) => {
    const token = sessionStorage.getItem('ca_session_token');
    if (token !== null) {
      cb({ sessionToken: token });
    } else {
      cb({});
    }
  },
});
