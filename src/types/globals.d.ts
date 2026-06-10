declare module '*.css';

declare global {
  var __APP_ENV__: Record<string, string | undefined> | undefined;
}

export {};
