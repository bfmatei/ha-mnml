import { createConnection, createLongLivedTokenAuth } from 'home-assistant-js-websocket';
import type { MessageBase } from 'home-assistant-js-websocket';

import type { Env } from './env.ts';

export interface Session {
  call: <T>(message: MessageBase) => Promise<T>;
  close: () => void;
}

export async function connect(env: Env): Promise<Session> {
  const connection = await createConnection({
    auth: createLongLivedTokenAuth(env.HA_URL, env.HA_TOKEN),
  });
  return {
    call: <T>(message: MessageBase): Promise<T> => connection.sendMessagePromise<T>(message),
    close: (): void => {
      connection.close();
    },
  };
}
