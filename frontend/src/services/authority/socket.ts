import { io, type Socket } from 'socket.io-client';
import { API_URL } from './http';

/** Every server event is `{ v, serverTime, data }`. Payloads contain no personal data; fetch details via REST. */
export interface Envelope<T> {
  v: number;
  serverTime: string;
  data: T;
}

export function createSocket(accessToken: string): Socket {
  return io(API_URL, { auth: { token: accessToken }, transports: ['websocket', 'polling'], reconnectionDelayMax: 10_000 });
}
