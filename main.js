const { HttpsServer, HttpServer, WssServer } = require("./Server");

const httpsServer = new HttpsServer();
const httpServer = new HttpServer(httpsServer.PORT);

httpsServer.start();
httpServer.start();
const wssServer = new WssServer(httpsServer);

httpsServer.api(wssServer.sockets);