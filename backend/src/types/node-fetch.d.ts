declare module 'node-fetch' {
  import * as http from 'http';
  import * as https from 'https';
  import { URL, URLSearchParams } from 'url';

  export class Request extends Body {
    constructor(input: RequestInfo, init?: RequestInit);
    readonly cache: RequestCache;
    readonly credentials: RequestCredentials;
    readonly destination: RequestDestination;
    readonly headers: Headers;
    readonly integrity: string;
    readonly keepalive: boolean;
    readonly method: string;
    readonly mode: RequestMode;
    readonly redirect: RequestRedirect;
    readonly referrer: string;
    readonly referrerPolicy: ReferrerPolicy;
    readonly url: string;
    clone(): Request;
  }

  export interface RequestInit {
    body?: BodyInit | null;
    headers?: HeadersInit;
    method?: string;
    redirect?: RequestRedirect;
    signal?: AbortSignal | null;
    agent?: http.Agent | https.Agent | ((parsedUrl: URL) => http.Agent | https.Agent);
    compress?: boolean;
    follow?: number;
    size?: number;
    timeout?: number;
  }

  export class Headers implements Iterable<[string, string]> {
    constructor(init?: HeadersInit);
    append(name: string, value: string): void;
    delete(name: string): void;
    get(name: string): string | null;
    has(name: string): boolean;
    set(name: string, value: string): void;
    forEach(callback: (value: string, name: string, parent: Headers) => void, thisArg?: any): void;
    entries(): IterableIterator<[string, string]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<string>;
    [Symbol.iterator](): IterableIterator<[string, string]>;
  }

  export class Body {
    readonly body: NodeJS.ReadableStream | null;
    readonly bodyUsed: boolean;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    json(): Promise<any>;
    text(): Promise<string>;
  }

  export class Response extends Body {
    constructor(body?: BodyInit | null, init?: ResponseInit);
    readonly headers: Headers;
    readonly ok: boolean;
    readonly redirected: boolean;
    readonly status: number;
    readonly statusText: string;
    readonly type: ResponseType;
    readonly url: string;
    clone(): Response;
    static error(): Response;
    static redirect(url: string, status?: number): Response;
  }

  export interface ResponseInit {
    headers?: HeadersInit;
    status?: number;
    statusText?: string;
  }

  export type RequestInfo = Request | string;

  export default function fetch(
    url: RequestInfo,
    init?: RequestInit
  ): Promise<Response>;
}