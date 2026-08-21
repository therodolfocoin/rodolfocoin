import { mintCoin, URI_DEFAULT, loadOrCreateWallet } from './lib.ts';
import { fetchMetadata, findMetadataPda, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { mplToolbox } from '@metaplex-foundation/mpl-toolbox';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { TOKEN_PROGRAM_ID, getMint } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { DEVNET_RPC, SYMBOL, DECIMALS } from './lib.ts';

async function main() {
  const uri = process.argv.includes('--uri')
    ? process.argv[process.argv.indexOf('--uri') + 1]
    : URI_DEFAULT;

  const { kp: payer } = loadOrCreateWallet();
  console.log(`wallet:  ${payer.publicKey.toBase58()}`);

  const { mint, tx } = await mintCoin({
    amount: Number(1_000_000n),
    recipient: payer.publicKey.toBase58(),
    uri,
    burnAuthority: true,
  });
  console.log(`mint:    ${mint}`);
  console.log(`tx:      https://explorer.solana.com/tx/${tx}?cluster=devnet`);

  const umi = createUmi(DEVNET_RPC).use(mplTokenMetadata()).use(mplToolbox());
  const md = await fetchMetadata(umi, findMetadataPda(umi, { mint }));
  const onChain = await getMint(
    new Connection(DEVNET_RPC, 'confirmed'),
    new PublicKey(mint),
    'confirmed',
    TOKEN_PROGRAM_ID,
  );
  console.log(`metadata: ${md.name} (${md.symbol}) uri=${md.uri}`);
  console.log(`supply:  ${Number(onChain.supply) / 10 ** DECIMALS} ${SYMBOL} (authority: ${onChain.mintAuthority ?? 'burned -> fixed'})`);
  console.log(`explorer: https://explorer.solana.com/address/${mint}?cluster=devnet`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});