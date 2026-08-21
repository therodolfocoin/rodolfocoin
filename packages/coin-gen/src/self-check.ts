import { Keypair } from '@solana/web3.js';
import assert from 'node:assert';
import { sharedMintAddress } from './lib.ts';

const a = Keypair.generate();
const b = Keypair.generate();
assert.equal(sharedMintAddress(a.secretKey), sharedMintAddress(a.secretKey), 'same wallet => same mint');
assert.notEqual(sharedMintAddress(a.secretKey), sharedMintAddress(b.secretKey), 'different wallet => different mint');
console.log('ok: shared mint is deterministic per wallet ->', sharedMintAddress(a.secretKey));
