class HttpError extends Error {
	/**
	* @description HTTP Error
	* @param {int} code status
	* @param {string} response statusText
	* @param {string} [msg] Additional message
	*/
	constructor(code, response, msg = null) {
		super(response);

		this.name = `WebSocket (HTTP) Error ${code}`;
		this.message = response;
		
		if (msg) this.message += `. ${msg}.`;

		this.stack = {
			status: code,
			statusText: response,
			msg: msg
		};

		Error.captureStackTrace(this, HttpError);
	}
}
class LoginError extends Error {
	/**
	* @description Login Error
	* @param {string} state state
	* @param {string} [msg] Additional message
	*/
	constructor(state, msg = null) {
		super(state);

		this.name = "Login Error";
		this.message = state;
		
		if (msg) this.message += `. ${msg}.`;

		this.stack = {
			state: state,
			msg: msg
		};

		Error.captureStackTrace(this, LoginError);
	}
}

module.exports = {HttpError, LoginError};