interface ParametersDict {
	[index: string]: string|number|undefined,
}

export class HttpError extends Error {
	public parameters: ParametersDict;

	constructor(code: number, response: string, msg?: string) {
		super(response);

		this.name = `WebSocket (HTTP) Error ${code}`;
		this.message = response;
		
		if (msg) this.message += `. ${msg}.`;

		this.parameters = {
			status: code,
			statusText: response,
			msg: msg
		};

		Error.captureStackTrace(this, HttpError);
	}
}
export class LoginError extends Error {
	public parameters: ParametersDict;

	constructor(state: string, msg?: string) {
		super(state);

		this.name = "Login Error";
		this.message = state;
		
		if (msg) this.message += `. ${msg}.`;

		this.parameters = {
			state: state,
			msg: msg
		};

		Error.captureStackTrace(this, LoginError);
	}
}