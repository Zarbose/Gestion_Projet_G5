const WebSocket = require("ws");

const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);

const HttpError = require("./Errors");

// Handle requests for static files
app.use(express.static("www"));

// Start the server
server.listen("3000", () => {
	console.log("Local DevServer Started on port 3000...");
});


const wsServer = new WebSocket.Server({
	server: server
});

let sockets = {};
wsServer.on("connection", function(socket) {
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

	socket.on("message", function(buffer) {
		try {
			const data = JSON.parse(buffer.toString());
			if (!data.type || !data.channel) {
				throw new HttpError(406, "Incomplete");
			}
			// console.log("GOT", data);
			console.info("Socket received", data.type);
			switch (data.type) {
			case "login":
				if (sockets[data.channel]) {
					sockets[data.channel].push(socket);
				}
				else {
					sockets[data.channel] = [ socket ];
				}
				socket.sendJSON({
					type: "login",
					state: "success"
				});
				break;
					
			default:
				if (sockets[data.channel]) {
					sockets[data.channel].forEach(ourSockets => {
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
	});
	
	socket.on("close", function() {
		console.info("WebSocket disconnected");
		for (const channel in sockets) {
			if (Object.hasOwnProperty.call(sockets, channel)) {
				sockets[channel] = sockets[channel].filter(
					ourSockets => ourSockets !== socket
				);
				if (sockets[channel].length <= 0) {
					delete sockets[channel];
					console.info(`Channel ${channel} has been deleted`);
				}
			}
		}
	});
	
	socket.on("open", function() {
		console.info("WebSocket open");
	});
});
console.log("Local WebSocket Server Started on port 3000...");

app.get("/API", (req, res) => {
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