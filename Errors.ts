export class HttpError extends Error {
	constructor(code: number, response: string, msg?: string) {
		super(response);

		this.name = `WebSocket (HTTP) Error ${code}`;
		this.message = response;
		
		if (msg) this.message += `. ${msg}.`;

		this.stack = JSON.stringify({
			status: code,
			statusText: response,
			msg: msg
		});

		Error.captureStackTrace(this, HttpError);
	}
}
export class LoginError extends Error {
	constructor(state: string, msg?: string) {
		super(state);

		this.name = "Login Error";
		this.message = state;
		
		if (msg) this.message += `. ${msg}.`;

		this.stack = JSON.stringify({
			state: state,
			msg: msg
		});

		Error.captureStackTrace(this, LoginError);
	}
}