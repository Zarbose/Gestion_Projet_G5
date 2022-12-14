import http = require("http");

abstract class Server {
	protected static _unsecurePort = 8080;
	protected static _securePort = 8443;
}

export class HttpServer extends Server{
	private server: http.Server;

	constructor(securePort?: number, unsecurePort?: number) {
		super();
		if (securePort) Server._securePort = securePort;
		if (unsecurePort) Server._unsecurePort = unsecurePort;
		this.server = http.createServer((req, res) => {
			const url = new URL(`http://${req.headers.host}${req.url}`);
			res.writeHead(301, {"Location": `https://${url.hostname}:${Server._securePort}${url.pathname}`});
			res.end();
		});
	}

	start() {
		this.server.listen(Server._unsecurePort, () => {
			console.info(`HTTP Server started on port ${Server._unsecurePort} redirect to port ${Server._securePort}`);
		});
	}
}

import fs = require("fs");
import https = require("https");
import express = require("express");
import { HttpError, LoginError } from "./Errors";

export class HttpsServer extends Server {
	private app = express();
	public server: https.Server;
	private SSL = {
		key: fs.readFileSync("./ssl/key.pem"),
		cert: fs.readFileSync("./ssl/cert.pem")
	};

	constructor(securePort?: number) {
		super();
		if (securePort) Server._securePort = securePort;
		this.server = https.createServer(this.SSL, this.app);
		// Handle requests for static files
		this.app.use(express.static("www"));
	}

	start() {
		this.server.listen(Server._securePort, () => {
			console.info(`HTTPS Server started on port ${Server._securePort}`);
		});
	}

	api(sockets: SocketsDict) {
		this.app.get("/API", (req, res) => {
			const url = new URL(`https://${req.headers.host}${req.url}`);
			if (url.searchParams.has("channels")) {
				const channels = [];
				for (const channel in sockets) {
					if (Object.hasOwnProperty.call(sockets, channel)) {
						channels.push(channel);
					}
				}
				res.send(channels);
			}
			else if (url.searchParams.has("users")) {
				const users: string[] = [];
				sockets[String(url.searchParams.get("channel"))].forEach(user => {
					users.push(user.user);
				});
				res.send(users);
			}
			else {
				res.status(404).send(`${req.url} not found`);
			}
		});  
	}
}

import { RawData, WebSocket, WebSocketServer } from "ws";

interface SocketsDict {
	[channel: string]: {
		socket: WebSocket,
		user: string
	}[];
}

export class WssServer extends Server {
	private server: WebSocketServer;
	public sockets: SocketsDict = {};

	constructor(httpsServer: HttpsServer) {
		super();
		this.server = new WebSocket.Server({
			server: httpsServer.server
		});

		this._connection();
		console.info(`WebSocket Server following HttpsServer on port ${Server._securePort}`);
	}

	private _connection() {
		this.server.on("connection", (socket) => {
			socket.on("message", (buffer) => {this._onMessage(socket, buffer); } );
			socket.on("close", () => (this._onClose(socket)));			
			
			socket.on("open", function() {
				// TODO: check if this ever called
				console.info("WebSocket open");
			});
		});
	}

	private _onMessage(socket: WebSocket, buffer: RawData) {
		function sendJSON (json: object) {
			socket.send(
				Buffer.from(
					JSON.stringify(
						json
					)
				)
			);
		}
		try {
			const data = JSON.parse(buffer.toString());
			if ( (data.type !== "login") && (!data.type && !data.channel && !data.user) ) {
				throw new HttpError(406, "Incomplete");
			}
			// console.log("GOT", data);
			console.info("Socket received", data.type);
			switch (data.type) {
			case "login":
				if (data.type && data.channel && data.user) {
					if (this.sockets[data.channel]) {
						this.sockets[data.channel].forEach(socketUserCollection => {
							if (socketUserCollection.user === data.user) {
								throw new LoginError("user");
							}
						});
						this.sockets[data.channel].push({
							socket: socket,
							user: data.user
						});
					}
					else {
						this.sockets[data.channel] = [{
							socket: socket,
							user: data.user
						}];
					}
					sendJSON({
						type: "login",
						state: "success"
					});
				}
				else {
					throw new LoginError("incomplete");
				}
				break;
					
			default:
				if (this.sockets[data.channel]) {
					if (data?.recipient && data.recipient !== "all") {
						this.sockets[data.channel].forEach(socketUserCollection => {
							if (socketUserCollection.socket !== socket && socketUserCollection.user === data.recipient) {
								socketUserCollection.socket.send(buffer);
							}
						});
					}
					else {
						this.sockets[data.channel].forEach(socketUserCollection => {
							if (socketUserCollection.socket !== socket) {
								socketUserCollection.socket.send(buffer);
							}
						});
					}
				}
				else throw new HttpError(406, "No channel", `Type is ${data?.type}`);
				break;
			}
		} catch (error) {
			if (error instanceof HttpError) {
				console.error(error);
				sendJSON({
					type: "error",
					code: error.parameters.status,
					msg: error.parameters.statusText
				});
			}
			else if (error instanceof LoginError) {
				console.error(error);
				sendJSON({
					type: "login",
					state: error.parameters.state,
				});
			}
			else {
				throw error;
			}
		}
	}

	private _onClose(socket: WebSocket) {
		console.info("WebSocket disconnected");
		for (const channel in this.sockets) {
			if (Object.hasOwnProperty.call(this.sockets, channel)) {
				this.sockets[channel] = this.sockets[channel].filter(
					socketUserCollection => socketUserCollection.socket !== socket
				);
				if (this.sockets[channel].length <= 0) {
					delete this.sockets[channel];
					console.info(`Channel ${channel} has been deleted`);
				}
			}
		}
	}
}