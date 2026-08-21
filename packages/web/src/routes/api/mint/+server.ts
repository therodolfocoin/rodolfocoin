import { json } from '@sveltejs/kit';
import { PublicKey } from '@solana/web3.js';
import { transferCoin } from '@rodolfocoins/coin-gen';

export async function POST({ request }) {
	let body: { amount?: unknown; address?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'mint data must be JSON, this is very important' }, { status: 400 });
	}
	const amount = body.amount;
	if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > 100) {
		return json({ ok: false, error: 'amount must be a whole number from 1 to 100' }, { status: 400 });
	}
	if (typeof body.address !== 'string' || body.address.length === 0) {
		return json({ ok: false, error: 'no wallet address given' }, { status: 400 });
	}
	let recipient: PublicKey;
	try {
		recipient = new PublicKey(body.address);
	} catch {
		return json({ ok: false, error: 'that is not a real solana address, try again' }, { status: 400 });
	}
	try {
		const res = await transferCoin({ amount, recipient: recipient.toBase58() });
		return json({ ok: true, ...res });
	} catch (e) {
		return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 500 });
	}
}