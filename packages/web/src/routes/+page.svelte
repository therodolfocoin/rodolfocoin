<script lang="ts">
	import { onMount } from 'svelte';
	import { Keypair } from '@solana/web3.js';

	let address = $state('');
	let secret = $state('');
	let amount = $state(50);
	let status = $state('waiting for money...');
	let progress = $state(0);
	let minting = $state(false);
	let result = $state<{ mint: string; tx: string } | null>(null);

	function newWallet() {
		const kp = Keypair.generate();
		address = kp.publicKey.toBase58();
		secret = JSON.stringify(Array.from(kp.secretKey));
		result = null;
	}

	function randomVisitor() {
		return Math.floor(Math.random() * 9999999) + 1337;
	}

	onMount(() => {
		newWallet();
		setTimeout(() => alert('*** CONGRATULATIONS!!! YOU ARE VISITOR #' + randomVisitor() + '!!! ***\n\nYou have been SELECTED to receive FREE RODOLFOCOINS!!! Click OK to claim your prize!!!'), 500);
	});

	async function mint() {
		if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
			status = 'ERROR!!! NUMBER MUST BE 1 TO 100!!! DO YOU NOT SPEAK ENGLISH???';
			return;
		}
		minting = true;
		status = 'MINTING... THIS MAY TAKE FOREVER (BLOCKCHAIN IS SLOW LOL)';
		progress = 3;
		const iv = setInterval(() => (progress = Math.min(progress + Math.random() * 23, 95)), 250);
		try {
			const res = await fetch('/api/mint', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amount, address })
			});
			const data = await res.json();
			clearInterval(iv);
			progress = 100;
			if (data.ok) {
				result = data;
				status = '*** SUCCESS!!! ' + amount + ' RODOLFOCOINS SENT TO YOUR FRESH FAKE WALLET!!! ***';
			} else {
				status = 'MINT FAILED: ' + data.error + ' (IT IS DEFINTELY NOT OUR FAULT)';
			}
		} catch {
			clearInterval(iv);
			status = 'NO INTERNET?!?! MINT FAILED!!! BLAME YOUR COMPUTER!!!';
		}
		minting = false;
		setTimeout(() => (progress = 0), 1500);
	}
</script>

<svelte:head>
	<link rel="icon" href="data:," />
	<meta name="keywords" content="free money, crypto, rodolfocoin, solana, get rich quick, not a scam" />
</svelte:head>

<main>
	<blink class="top">*** FREE MONEY FREE MONEY FREE MONEY ***</blink>

	<h1 class="papyrus">~~ WELCOME TO <span class="rainbow">RODOLFOCOIN</span>!!! ~~</h1>
	<h2 class="comic">THE #1 MOST TRUSTEDEST CRYPTO IN THE UNIVERSE</h2>

	<marquee behavior="alternate" scrollamount="12" class="comic fancy">★★★★★ 100% LEGIT ★★★★★ NOT A SCAM (WE PROMISE) ★★★★★ AS SEEN ON THE INTERNET ★★★★★</marquee>

	<center>
<table border="7" class="spin-box">
				<tbody>
					<tr>
						<td>
							<img src="/rodolfocoin.jpg" alt="rodolfocoin logo" class="spin" width="180" height="180" />
						</td>
						<td>
							<p class="comic small-grey">
								This is the REAL Rodolfocoin. Do NOT steal this picture.<br />
								It is copyrighted by Rodolfo Corp. since 1998.
							</p>
						</td>
					</tr>
				</tbody>
			</table>
	</center>

	<blink class="sec">SECURED WITH THE BESTEST BLOCKCHAIN (SOLANA)</blink>

	<fieldset class="money-box">
		<legend class="papyrus bigg">STEP 1: YOUR FRESH NEW FAKE WALLET (SO REAL)</legend>
		<center>
			<p class="comic">Your wallet address (it is %100 real i promise):</p>
			<div class="address-box comic blink-green">{address || 'generating...'}</div>
			<br />
			<button class="ugly-btn" onclick={() => newWallet()}>GENERATE ANOTHER WALLET!!!</button>
			<br /><br />
			<details class="comic secret-box">
				<summary>Click here for SECRET KEY (shhh do not tell anyone)</summary>
				<p class="tiny-word-wrap">{secret}</p>
				<p class="small-grey">(send this to us if you want MORE free coins, trust us)</p>
			</details>
		</center>
	</fieldset>

	<fieldset class="money-box">
		<legend class="papyrus bigg">STEP 2: HOW MANY FREE COINS??</legend>
		<center>
			<label class="comic huge">1</label>
			<input
				type="number"
				class="amount-input comic"
				min="1"
				max="100"
				maxlength="3"
				bind:value={amount}
			/>
			<label class="comic huge">100</label>
			<p class="comic small-grey">(between 1 and 100, any other number and you get NOTHING)</p>
		</center>
	</fieldset>

	<center>
		<button class="mint-btn papyrus" disabled={minting} onclick={() => mint()}>
			{minting ? 'MINTING... PLEASE WAIT!!!' : 'CLICK HERE TO GET FREE MONEY NOW!!!'}
		</button>
	</center>

	{#if progress > 0}
		<div class="progress-bar">
			<div class="progress-fill comic" style="width: {progress}%">{Math.round(progress)}% ...SO FAST</div>
		</div>
	{/if}

	<blink class="status blink-red comic bigg">{status}</blink>

	{#if result}
		<fieldset class="money-box yay">
			<legend class="papyrus bigg">YOUR FREE COINS ARE ON THE WAY!!!</legend>
			<center class="comic">
				<p>MINT ADDRESS (VERY COOL): <a href="https://explorer.solana.com/address/{result.mint}?cluster=devnet" class="fancy">click here</a></p>
				<p>TRANSACTION (SO BLOCKCHAIN): <a href="https://explorer.solana.com/tx/{result.tx}?cluster=devnet" class="fancy">click here</a></p>
				<p class="small-grey">if it does not arrive, check again in 72 hours. no refunds.</p>
			</center>
		</fieldset>
	{/if}

	<marquee direction="right" scrollamount="8" class="comic trust">
		TRUSTED BY: NASA ★ YOUR NEIGHBOR ★ THE POST OFFICE ★ BILL GATES' COUSIN ★ SOME GUY ON REDDIT ★ ME
	</marquee>

	<center class="comic cert">✔ QUALITY ASSURED ✔ <br /><span class="small-grey">certified by Rodolfo himself (he is my uncle)</span></center>

	<footer class="comic upside">
		© 1998-2003 RODOLFO CORP. ALL RIGHTS RESERVED. NO REFUNDS. NO TAKE-BACKS.
		<br />you are visitor number: <span class="blink-green">{randomVisitor()}</span>
	</footer>
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Comic Sans MS', 'Comic Sans', 'Chalkboard SE', cursive;
		background: repeating-linear-gradient(45deg, #ffff00 0px, #ffff00 40px, #00ffff 40px, #00ffff 80px);
		cursor: crosshair;
	}
	:global(blink) {
		animation: flash 0.8s steps(1) infinite;
	}
	:global(a:hover) {
		cursor: hand;
		font-size: 2em;
	}
	main {
		max-width: 900px;
		margin: 0 auto;
		background: #ff69b4;
		border-left: 12px dashed #0000ff;
		border-right: 12px dashed #0000ff;
		border-bottom: 20px double #ff0000;
		padding: 12px;
		text-align: center;
	}
	.comic {
		font-family: 'Comic Sans MS', 'Comic Sans', cursive;
	}
	.papyrus {
		font-family: 'Papyrus', 'Lucida Handwriting', fantasy;
	}
	.top {
		font-family: 'Times New Roman', serif;
		background: #ff0000;
		color: #00ff00;
		font-size: 11pt;
		display: block;
	}
	h1 {
		color: #0000ff;
		font-size: 42pt;
		margin: 4px 0;
		letter-spacing: 4px;
	}
	h2 {
		color: #ff0000;
		font-size: 18pt;
	}
	.rainbow {
		background: linear-gradient(to right, #ff0000, #ff7700, #ffff00, #00ff00, #0000ff, #8b00ff);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		font-style: italic;
		font-weight: bold;
		text-shadow: 3px 3px 0 #000;
	}
	.fancy {
		color: #ff00ff;
		text-decoration: underline wavy #00ffff;
		text-shadow: 2px 2px 3px #000;
	}
	.spin {
		animation: spin 3s linear infinite;
		border: 8px ridge #ff0000;
	}
	.spin-box {
		border: 10px groove #00ff00;
		background: #cc99ff;
	}
	.small-grey {
		font-size: 9pt;
		color: #333333;
	}
	.money-box {
		background: #00ff00;
		border: 7px double #ff0000;
		margin: 18px 4px;
	}
	.yay {
		background: gold;
		border-color: magenta;
	}
	.bigg {
		font-size: 20pt;
		font-weight: bold;
		color: #000080;
	}
	.huge {
		font-size: 28pt;
		color: #ff0000;
	}
	.address-box {
		background: #000000;
		color: #00ff00;
		padding: 12px;
		font-size: 14pt;
		word-break: break-all;
		border: 4px dotted #ffff00;
	}
	.secret-box {
		background: #99ff99;
		border: 3px solid #999900;
		font-size: 10pt;
		max-width: 90%;
		margin: 0 auto;
	}
	.tiny-word-wrap {
		word-break: break-all;
		font-size: 7pt;
	}
	.amount-input {
		width: 90px;
		font-size: 30pt;
		color: #ff00ff;
		background: #ffff99;
		border: 6px dashed #0000ff;
		text-align: center;
		font-weight: bold;
	}
	.ugly-btn {
		font-family: 'Comic Sans MS', cursive;
		font-size: 15pt;
		font-weight: bold;
		color: #ffffff;
		background: linear-gradient(#ff0000, #00ff00, #0000ff);
		border: 5px ridge #ff00ff;
		padding: 10px;
		cursor: hand;
	}
	.mint-btn {
		font-size: 24pt;
		font-weight: bold;
		color: #000000;
		background: #ff0000;
		border: 8px outset #00ff00;
		padding: 16px 40px;
		text-shadow: 2px 2px #ff00ff;
		cursor: hand;
		animation: shake 0.15s linear infinite;
	}
	.progress-bar {
		width: 80%;
		margin: 12px auto;
		border: 4px solid #000000;
		background: #ffffff;
		height: 28px;
	}
	.progress-fill {
		height: 100%;
		background: repeating-linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff);
		line-height: 28px;
		font-size: 12pt;
		font-weight: bold;
	}
	.status {
		font-size: 18pt;
		display: block;
		margin: 10px 0;
	}
	.blink-green {
		animation: flash 1s steps(2) infinite;
	}
	.blink-red {
		animation: flash 0.4s steps(2) infinite;
	}
	.trust {
		background: #00ffff;
		color: #800000;
	}
	.cert {
		margin: 14px 0;
		color: #000000;
		font-size: 14pt;
		background: #ffcc00;
		border: 3px double #000000;
		display: inline-block;
		padding: 6px;
	}
	.upside {
		transform: rotate(180deg);
		background: #333333;
		color: #ffff00;
		font-size: 10pt;
		padding: 10px;
	}
	@keyframes flash {
		50% {
			opacity: 0;
		}
	}
	@keyframes spin {
		100% {
			transform: rotate(360deg);
		}
	}
	@keyframes shake {
		25% {
			transform: translate(2px, -2px);
		}
		75% {
			transform: translate(-2px, 2px);
		}
	}
</style>