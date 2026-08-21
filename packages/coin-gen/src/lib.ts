import {
  createV1,
  mplTokenMetadata,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  AuthorityType,
  createTokenIfMissing,
  findAssociatedTokenPda,
  getSplAssociatedTokenProgramId,
  mintTokensTo,
  mplToolbox,
  setAuthority,
} from '@metaplex-foundation/mpl-toolbox';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createSignerFromKeypair, generateSigner, signerIdentity } from '@metaplex-foundation/umi';
import { base58 } from '@metaplex-foundation/umi/serializers';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export const DEVNET_RPC = 'https://api.devnet.solana.com';
export const NAME = 'Rodolfocoin';
export const SYMBOL = '$K';
export const DECIMALS = 6;
export const URI_DEFAULT = 'https://i.imgur.com/vsqRm7d.jpeg';
export const KEY_PATH = '../../.keys/devnet.json';

export function loadOrCreateWallet(): { kp: Keypair; secret: Uint8Array } {
  if (existsSync(KEY_PATH)) {
    const secret = Uint8Array.from(JSON.parse(readFileSync(KEY_PATH, 'utf8')));
    return { kp: Keypair.fromSecretKey(secret), secret };
  }
  const kp = Keypair.generate();
  mkdirSync('../../.keys', { recursive: true });
  writeFileSync(KEY_PATH, JSON.stringify([...kp.secretKey]));
  return { kp, secret: new Uint8Array(kp.secretKey) };
}

export async function ensureFunded(conn: Connection, pubkey: Keypair['publicKey']) {
  for (let i = 0; i < 5; i++) {
    if ((await conn.getBalance(pubkey)) >= 0.05 * LAMPORTS_PER_SOL) return;
    try {
      await conn.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL);
    } catch {
      // faucet dry/rate-limited; keep trying
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if ((await conn.getBalance(pubkey)) < 0.005 * LAMPORTS_PER_SOL)
    throw new Error('could not fund wallet on devnet (faucet dry) — retry later');
}

export async function mintCoin(opts: {
  amount: number;
  recipient: string;
  uri?: string;
  burnAuthority?: boolean;
}): Promise<{ mint: string; tx: string; payer: string }> {
  const { kp: payer, secret } = loadOrCreateWallet();
  await ensureFunded(new Connection(DEVNET_RPC, 'confirmed'), payer.publicKey);

  const umi = createUmi(DEVNET_RPC).use(mplTokenMetadata()).use(mplToolbox());
  const signer = createSignerFromKeypair(umi, umi.eddsa.createKeypairFromSecretKey(secret));
  umi.use(signerIdentity(signer));

  const mint = generateSigner(umi);
  const tx = await createV1(umi, {
    mint,
    authority: umi.identity,
    payer: umi.identity,
    updateAuthority: umi.identity.publicKey,
    name: NAME,
    symbol: SYMBOL,
    uri: opts.uri ?? URI_DEFAULT,
    sellerFeeBasisPoints: 0,
    tokenStandard: TokenStandard.Fungible,
    decimals: DECIMALS,
    isMutable: true,
  })
    .add(
      createTokenIfMissing(umi, {
        mint: mint.publicKey,
        owner: opts.recipient,
        ataProgram: getSplAssociatedTokenProgramId(umi),
      }),
    )
    .add(
      mintTokensTo(umi, {
        mint: mint.publicKey,
        token: findAssociatedTokenPda(umi, { mint: mint.publicKey, owner: opts.recipient }),
        amount: BigInt(Math.round(opts.amount * 10 ** DECIMALS)),
      }),
    )
    .sendAndConfirm(umi);

  if (opts.burnAuthority) {
    await setAuthority(umi, {
      owned: mint.publicKey,
      owner: umi.identity,
      authorityType: AuthorityType.MintTokens,
      newAuthority: null,
    }).sendAndConfirm(umi);
  }

  return {
    mint: mint.publicKey.toString(),
    tx: base58.deserialize(tx.signature)[0],
    payer: payer.publicKey.toBase58(),
  };
}