// Non-client helper module (stands in for cookies-next and friends). The CLI
// traces `setCookie` here, finds no client, and lists it as a non-client
// binding for every provider.
export function setCookie(_name: string, _value: string, _options: Record<string, unknown>): void {}
