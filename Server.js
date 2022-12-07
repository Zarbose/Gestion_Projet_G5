const http = require("http");

class HttpServer {
	#server = http.Server;
	#unsecurePort = 0;
	#securePort = 0;

	/**
	 * @param {int} [securePort] HTTPS
	 * @param {int} [unsecurePort] HTTP
	 */
	constructor(securePort = 4443, unsecurePort = 8080) {
		this.#securePort = securePort;
		this.#unsecurePort = unsecurePort;
		this.#server = http.createServer(function(req, res) {
			const url = new URL(`http://${req.headers.host}${req.url}`);
			res.writeHead(301, {"Location": `https://${url.hostname}:${this.#securePort}${url.pathname}`});
			res.end();
		});
	}

	start() {
		this.#server.listen(this.#unsecurePort, () => {
			console.log(`HTTP Server started on port ${this.#unsecurePort} redirect to port ${this.#securePort}`);
		});
	}
}

const fs = require("fs");
const https = require("https");
const express = require("express");
const { HttpError } = require("./Errors");

class HttpsServer {
	#app = express();
	#securePort = 0;
	server = https.Server;
	#SSL = {
		key: fs.readFileSync("./ssl/key.pem"),
		cert: fs.readFileSync("./ssl/cert.pem")
	};

	/**
	 * @param {int} securePort HTTPS
	 */
	constructor(securePort = 8443) {
		this.#securePort = securePort;
		this.server = https.createServer(this.#SSL, this.#app);
		// Handle requests for static files
		this.#app.use(express.static("www"));
	}

	start() {
		this.server.listen(this.#securePort, () => {
			console.log(`HTTPS Server started on port ${this.#securePort}`);
		});
	}

	/**
	 * @param {Object.<WebSocket[]>} sockets 
	 */
	api(sockets) {
		this.#app.get("/API", (req, res) => {
			const url = new URL(req.headers.host + req.url);
			if (url.searchParams.has("channels")) {
				const channels = [];
				for (const channel in sockets) {
					if (Object.hasOwnProperty.call(sockets, channel)) {
						channels.push(channel);
					}
				}
				res.send(channels);
			}
			else {
				res.status(404).send(`${req.url} not found`);
			}
		});  
	}
}

const { WebSocket, WebSocketServer } = require("ws");

class WssServer {
	#server = WebSocketServer;
	sockets = {};

	/**
	 * @param {HttpsServer} httpsServer 
	 */
	constructor(httpsServer) {
		this.#server = new WebSocket.Server({
			server: httpsServer.server
		});

		this.#connection();
		console.log(`WebSocket Server started on ${httpsServer.server._connectionKey}`);
	}

	#connection() {
		const glonalThis = this;
		this.#server.on("connection", function(socket) {
			/**
			 * @description socket.send a Buffer from a String from a JSON
			 * @param {Object} json 
			 */
			socket.sendJSON = function (json) {
				socket.send(
					Buffer.from(
						JSON.stringify(
							json
						)
					)
				);
			};


			socket.on("message", function(buffer) {glonalThis.#onMessage(socket, buffer); } );
			socket.on("close", () => (glonalThis.#onClose(socket)));			
			
			socket.on("open", function() {
				// TODO: check if this called ever
				console.info("WebSocket open");
			});
		});
	}

	/**
	 * @param {WebSocket} socket 
	 * @param {Buffer} buffer 
	 */
	#onMessage(socket, buffer) {
		try {
			const data = JSON.parse(buffer.toString());
			if (!data.type || !data.channel) {
				throw new HttpError(406, "Incomplete");
			}
			// console.log("GOT", data);
			console.info("Socket received", data.type);
			switch (data.type) {
			case "login":
				if (this.sockets[data.channel]) {
					this.sockets[data.channel].push(socket);
				}
				else {
					this.sockets[data.channel] = [ socket ];
				}
				socket.sendJSON({
					type: "login",
					state: "success"
				});
				break;
					
			default:
				if (this.sockets[data.channel]) {
					this.sockets[data.channel].forEach(ourSockets => {
						if (ourSockets !== socket) {
							ourSockets.send(buffer);
						}
					});
				}
				else throw new HttpError(406, "No channel");
				break;
			}
		} catch (error) {
			if (error instanceof HttpError) {
				console.error(error);
				socket.sendJSON({
					type: "error",
					msg: `${error.stack.status} ${error.stack.statusText}`
				});
			}
			else {
				throw new error;
			}
		}
	}

	/**
	 * @param {WebSocket} socket 
	 */
	#onClose(socket) {
		console.info("WebSocket disconnected");
		for (const channel in this.sockets) {
			if (Object.hasOwnProperty.call(this.sockets, channel)) {
				this.sockets[channel] = this.sockets[channel].filter(
					ourSockets => ourSockets !== socket
				);
				if (this.sockets[channel].length <= 0) {
					delete this.sockets[channel];
					console.info(`Channel ${channel} has been deleted`);
				}
			}
		}
	}
}


module.exports = {HttpServer, HttpsServer, WssServer};