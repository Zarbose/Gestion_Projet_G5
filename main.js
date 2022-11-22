const express = require("express");
const app = express();
const http = require("http");
const createError = require("http-errors");
const server = http.createServer(app);

// Handle requests for static files
app.use(express.static("www"));

// Start the server
server.listen("3000", () => {
	console.log("Local DevServer Started on port 3000...");
});

const WebSocket = require("ws");
const wsServer = new WebSocket.Server({
	server: server
});

/**
 * @description Must return function because there is no throw !
 * @param {int} code 
 * @param {string} msg 
 * @returns
 */
function httpWarning(code, msg = null) {
	console.warn(createError(code, msg));
	return createError(code, msg);
}

let sockets = {};
wsServer.on("connection", function(socket) {
	socket.on("message", function(buffer) {
		const data = JSON.parse(buffer.toString());
		if (!data.type || !data.channel) {
			socket.send(JSON.stringify({
				type: "error",
				msg: "406 Incomplete"
			}));
			return httpWarning(406, "Incomplete");
		}
		console.log("GOT", data);
		switch (data.type) {
		case "login":
			if (sockets[data.channel]) {
				sockets[data.channel].push(socket);
			}
			else {
				sockets[data.channel] = [ socket ];
			}
			socket.send(Buffer.from(JSON.stringify({
				type: "login",
				state: "success"
			})));
			break;

		case "message":
		case "RTCPeerOffer":
		case "RTCPeerAnswer":
		case "icecandidate":
			if (sockets[data.channel]) {
				sockets[data.channel].forEach(localSockets => {
					if (localSockets !== socket) {
						localSockets.send(buffer);
					}
				});
			}
			else return httpWarning(406, "No channel");
			break;

		default:
			return httpWarning(501, `${data.type} not found`);
			// break;
		}
	});

	socket.on("close", function() {
		console.log("WebSocket disconnected");
		for (const channel in sockets) {
			if (Object.hasOwnProperty.call(sockets, channel)) {
				sockets[channel] = sockets[channel].filter(
					localSockets => localSockets !== socket
				);
				if (sockets[channel].length <= 0) {
					delete sockets[channel];
					console.log(`Channel ${channel} has been deleted`);
				}
			}
		}
	});

	socket.on("open", function() {
		console.log("WebSocket open");
	});
});
console.log("Local WebSocket Server Started on port 3000...");

app.get("/API", (req, res) => {
	const url = new URL(req.headers.host + req.url);
	const urlParam = url.searchParams;
	if (urlParam.has("channels")) {
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