declare module "@nxenjs/discord-rich-presence" {
  import { EventEmitter } from "events";
  import { Socket } from "net";

  /** @see https://docs.discord.com/developers/events/gateway-events#activity-object */
  export interface Activity {
    name?: string;
    /** 0 Playing, 2 Listening, 3 Watching, 5 Competing */
    type?: 0 | 2 | 3 | 5;
    /** 0 name, 1 state, 2 details */
    status_display_type?: 0 | 1 | 2;
    state?: string;
    state_url?: string;
    details?: string;
    details_url?: string;
    timestamps?: {
      /** Unix time in milliseconds */
      start?: number;
      /** Unix time in milliseconds */
      end?: number;
    };
    assets?: {
      large_image?: string;
      large_text?: string;
      large_url?: string;
      small_image?: string;
      small_text?: string;
      small_url?: string;
    };
    party?: {
      id?: string;
      /** [current size, max size] */
      size?: [number, number];
    };
    secrets?: {
      join?: string;
      spectate?: string;
      match?: string;
    };
    /** Up to 2 buttons */
    buttons?: { label: string; url: string }[];
    instance?: boolean;
  }

  export interface Packet {
    OPCode: number;
    data: any;
  }

  export class Client extends EventEmitter {
    clientId: string | null;
    /** The Discord user, populated once the "ready" event fires. */
    user: any;
    connected: boolean;
    socket: Socket | null;

    constructor();

    /** Connects to Discord. Resolves before the handshake completes; wait for "ready". */
    login(clientId: string): Promise<this>;
    destroy(): Promise<void>;
    /** Throws if not connected. Returns the result of `socket.write`. */
    setActivity(activity: Activity | null, pid?: number): boolean;
    clearActivity(pid?: number): boolean;

    on(event: "ready", listener: (packet: Packet) => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "close", listener: () => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;

    once(event: "ready", listener: (packet: Packet) => void): this;
    once(event: "error", listener: (err: Error) => void): this;
    once(event: "close", listener: () => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;
  }

  export const version: string;

  const _default: {
    version: string;
    Client: typeof Client;
  };
  export default _default;
}
