export async function generateKeyPair(){
  return await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign','verify']
  );
}

export async function exportPublicKey(key: CryptoKey){
  const raw = await crypto.subtle.exportKey('spki', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importPublicKey(spkiB64: string){
  const raw = Uint8Array.from(atob(spkiB64), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'spki',
    raw,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify']
  );
}

export async function signPayload(payload: string, privateKey: CryptoKey){
  const data = new TextEncoder().encode(payload);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function verifyPayload(payload: string, signatureB64: string, publicKey: CryptoKey){
  const data = new TextEncoder().encode(payload);
  const sig = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
  return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, sig, data);
}

