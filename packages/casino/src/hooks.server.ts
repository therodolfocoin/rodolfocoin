import type { HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = ({ error, event }) => {
	console.error('HOOK ERROR:', error, 'on', event.url.pathname);
	return { message: 'Internal Error' };
};
