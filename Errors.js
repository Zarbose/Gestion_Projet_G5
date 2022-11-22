class HttpError extends Error {
	/**
	* @description HTTP Error
	* @param {int} code status
	* @param {string} response statusText
	* @param {string} [msg] Additional message
	*/
	constructor(code, response, msg = null) {
		super(response);

		this.name = `HTTP Error ${code}`;
		this.message = response;
		
		if(msg) this.message += `. ${msg}.`;

		this.stack = {
			status: code,
			statusText: response,
			msg: msg
		};

		Error.captureStackTrace(this, HttpError);
	}
}

module.exports = HttpError;