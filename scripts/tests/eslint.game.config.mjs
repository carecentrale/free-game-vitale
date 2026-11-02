// ESLint settings for the game script: browser globals only, and report any undeclared name.
export default [{
  files: ['**/*.mjs'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: {
    window: 'readonly', document: 'readonly', navigator: 'readonly', performance: 'readonly', localStorage: 'readonly',
    sessionStorage: 'readonly', location: 'readonly', addEventListener: 'readonly', removeEventListener: 'readonly',
    requestAnimationFrame: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly',
    clearInterval: 'readonly', console: 'readonly', atob: 'readonly', btoa: 'readonly', fetch: 'readonly',
    URL: 'readonly', URLSearchParams: 'readonly', Image: 'readonly', HTMLElement: 'readonly', Event: 'readonly',
    CustomEvent: 'readonly', alert: 'readonly', confirm: 'readonly', prompt: 'readonly', getComputedStyle: 'readonly',
    devicePixelRatio: 'readonly', innerWidth: 'readonly', innerHeight: 'readonly', crypto: 'readonly',
    Blob: 'readonly', FileReader: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly', WebSocket: 'readonly',
    Audio: 'readonly', Element: 'readonly', KeyboardEvent: 'readonly', MouseEvent: 'readonly', PointerEvent: 'readonly',
    TouchEvent: 'readonly', WheelEvent: 'readonly', ResizeObserver: 'readonly', Node: 'readonly', Map: 'readonly', Set: 'readonly',
    Math: 'readonly', JSON: 'readonly', Object: 'readonly', Array: 'readonly', Number: 'readonly', String: 'readonly',
    Promise: 'readonly', Date: 'readonly', Uint8Array: 'readonly', Float32Array: 'readonly', Int32Array: 'readonly',
    Uint32Array: 'readonly', Error: 'readonly', Symbol: 'readonly', Boolean: 'readonly', RegExp: 'readonly', Infinity: 'readonly', NaN: 'readonly', isNaN: 'readonly', parseInt: 'readonly', parseFloat: 'readonly',
    Uint8ClampedArray: 'readonly', Float64Array: 'readonly', WeakMap: 'readonly', Proxy: 'readonly', Reflect: 'readonly', BigInt: 'readonly', undefined: 'readonly', globalThis: 'readonly', encodeURIComponent: 'readonly', decodeURIComponent: 'readonly', encodeURI: 'readonly', decodeURI: 'readonly', escape: 'readonly', unescape: 'readonly', queueMicrotask: 'readonly', structuredClone: 'readonly', Function: 'readonly', Blob: 'readonly', XMLHttpRequest: 'readonly', HTMLCanvasElement: 'readonly', CanvasRenderingContext2D: 'readonly', Path2D: 'readonly', ImageData: 'readonly', DOMParser: 'readonly', history: 'readonly', screen: 'readonly', visualViewport: 'readonly', caches: 'readonly', indexedDB: 'readonly', Worker: 'readonly', Notification: 'readonly', ErrorEvent: 'readonly', PromiseRejectionEvent: 'readonly', AbortController: 'readonly', Intl: 'readonly', WeakSet: 'readonly', Atomics: 'readonly', SharedArrayBuffer: 'readonly', ArrayBuffer: 'readonly', DataView: 'readonly', Int8Array: 'readonly', Int16Array: 'readonly', Uint16Array: 'readonly', Float16Array: 'readonly', BigInt64Array: 'readonly', BigUint64Array: 'readonly',
  } },
  rules: { 'no-undef': 'error' },
}];
