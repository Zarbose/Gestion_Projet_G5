const { HttpsServer, HttpServer, WssServer } = require("./transpiler/Server");

console.log(process.argv[0]);
console.log(process.argv[1]);
console.log(process.argv[2]);

const httpsServer = new HttpsServer();
const httpServer = new HttpServer();

httpsServer.start();
httpServer.start();
const wssServer = new WssServer(httpsServer);

httpsServer.api(wssServer.sockets);