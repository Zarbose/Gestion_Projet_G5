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

function httpWarning(code, msg = null) {
	console.warn(createError(code, msg));
	return createError(code, msg);
}

let sockets = {};
wsServer.on("connection", function(socket) {  
	// When you receive a message, send that message to every socket.
	socket.on("message", function(buffer) {
		const data = JSON.parse(buffer.toString());
		if (!data.type || !data.channel) return httpWarning(406);
		console.log("Message", data);
		switch (data.type) {
		case "login":
			if (sockets[data.channel]) {
				sockets[data.channel].push(socket);
			}
			else {
				sockets[data.channel] = [ socket ];
			}
			break;

		case "message":
			if (sockets[data.channel]) {
				sockets[data.channel].forEach(s => s.send(buffer));
			}
			else return httpWarning(406);
			break;

		default:
			return httpWarning(501, `${data.type} not found`);
            // break;
		}
	});
  
	// When a socket closes, or disconnects, remove it from the array.
	socket.on("close", function() {
		console.log("WebSocket disconnected");
		for (const channel in sockets) {
			if (Object.hasOwnProperty.call(sockets, channel)) {
				sockets[channel] = sockets[channel].filter(s => s !== socket);
				if (sockets[channel].length <= 0) {
					delete sockets[channel];
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