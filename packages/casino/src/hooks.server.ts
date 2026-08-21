import type { HandleServerError } from '@sveltejs/kit';

// ponytail: log only unexpected (5xx) errors — 404s are just bot scan noise
export const handleError: HandleServerError = ({ error }) => {
	const status = (error as { status?: number }).status ?? 500;
	if (status >= 500) console.error('HOOK ERROR:', error);
	return { message: 'Internal Error' };
};
