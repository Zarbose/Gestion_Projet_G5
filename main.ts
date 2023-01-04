import { writeFileSync } from "node:fs";
import { HttpsServer, HttpServer, WssServer } from "./Server";

process.title = "Gestion_Projet_G5";

if (process.argv[2]) {
	try {
		const url = new URL(`https://${process.argv[2]}`);
		const data = new Uint8Array(
			Buffer.from(
				JSON.stringify({
					ip: url.hostname,
					port: url.port
				})
			)
		);
		writeFileSync("./www/src/WebSocketConfig.json", data);
	}
	catch (error) {
		console.info("Argument n°2 is the URL where the client connects", error);
	}
}

const httpsServer = new HttpsServer();
const httpServer = new HttpServer();
const wssServer = new WssServer(httpsServer);

httpServer.start();
httpsServer.start();

httpsServer.api(wssServer.sockets);