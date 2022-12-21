abstract class Login {
	protected static _channel: string = "";
	protected static _user: string = "";

	setLogin(channel: string, user: string) {
		Login._channel = channel;
		Login._user = user;
	}
}

export class WssClient extends Login {
	private socket: WebSocket;
	private iceClient: IceClient;

	constructor(iceClient: IceClient, ip = "localhost", port = 8443) {
		super();
		const url = new URL(`wss://${ip}:${port}/`);
		this.socket = new WebSocket(url);
		this.iceClient = iceClient;
	}

	/**
	 * @description WebSocket.send a String from a JSON
	 * @note Autocompletion with current channel and user
	 */
	sendJSON(json: object) {
		this.socket.send(
			JSON.stringify(Object.assign({
				channel: Login._channel,
				user: Login._user,
			}, json))	
		);
	}

	/**
	 * @description WebSocket.send
	 * @note No channel nor user
	 */
	send(string: string) {
		this.socket.send(string);
	}

	/**
	 * @param {function(string): void} login Frontend function to be called when connected
	 * @param {function(string, string): void} chat Frontend function to be called when a chat arrives
	 */
	start(login: (state: string) => void, chat: (newUser: string, message: string) => void) {
		const globalThis = this;
		this.socket.onmessage = function (message) {
			message.data.text().then((string: string) => {
				const data = JSON.parse(string);
			
				console.info("Socket received", data.type);
		
				switch(data.type) {
				case "message":
					chat(data.user, data.message);
					break;
				case "RTCPeerOffer":
					// console.log(`Channel ${data.type}: RTCPeerOffer`, new RTCSessionDescription(data.offer));
					globalThis.iceClient.peerOffer(new RTCSessionDescription(data.offer), data.user);
					break;
				case "RTCPeerAnswer": {
					globalThis.iceClient.peerAnswer(new RTCSessionDescription(data.answer), data.user);
					break;
				}
				case "IceCandidate": {
					globalThis.iceClient.newCandidate(new RTCIceCandidate(data.candidate), data.user);
					break;
				}
				case "login":
					login(data.state);
					break;
				case "error":
					console.error(data.msg);
					break;
				default:
					throw new Error(`Internal error, ${data.type} no action to be done`);
					// break;
				}
			});
		};
		this.socket.onerror = function (err) {
			console.warn("Got error", err); 
		};
		this.socket.onopen = function () { 
			console.log("Connected");
		};
	}

}

interface RTCPeerConnectionDict {
	[index: string]: RTCPeerConnection;
}

export class IceClient extends Login {
	private rtcPeerConnections: RTCPeerConnectionDict = {};
	private wssClient: WssClient;
	videoTrack: (arg0: readonly MediaStream[]) => void;


	// set wssClient(wssClient: WssClient) {
	// 	this.wssClient = wssClient;
	// }

	constructor() {
		super();
	}

	start(videoTrack: (arg0: readonly MediaStream[]) => void) {
		this.videoTrack = videoTrack;
		
	}

	/**
	 * @param {MediaStream} srcObject 
	 */
	sendVideo(srcObject: MediaStream) {
		// FIXME: this._user is initiliased only when setLogin is called
		console.info(`${Login._user} added in RTCPeerConnectionDict`);
		this.rtcPeerConnections[Login._user] = new RTCPeerConnection();
		console.log(srcObject.getTracks());
		this.rtcPeerConnections[Login._user].addTrack(srcObject.getVideoTracks()[0], srcObject);
		this.rtcPeerConnections[Login._user].addTrack(srcObject.getAudioTracks()[0], srcObject);

		this.rtcPeerConnections[Login._user].createOffer().then(offer => 
			this.rtcPeerConnections[Login._user].setLocalDescription(offer)
		).then(() => {
			this.wssClient.sendJSON({
				type: "RTCPeerOffer",
				offer: this.rtcPeerConnections[Login._user].localDescription.toJSON()
			});
		});

	}

	/**
	 * @param {RTCSessionDescription} offer 
	 * @param {string} newUser 
	 */
	peerOffer(offer: RTCSessionDescription, newUser: string) {
		if (false && !Object.hasOwnProperty.call(this.rtcPeerConnections, newUser)) {
			// FIXME: when already connected to newUsers the Login._user is already initiliased
			if (!this.rtcPeerConnections[Login._user]) this.rtcPeerConnections[Login._user] = new RTCPeerConnection();
			this.rtcPeerConnections[newUser] = this.rtcPeerConnections[Login._user];
			this.rtcPeerConnections[Login._user] = new RTCPeerConnection();
		}
		if (!Object.hasOwnProperty.call(this.rtcPeerConnections, newUser)) {
			console.info(`${newUser} added in RTCPeerConnectionDict`);
			this.rtcPeerConnections[newUser] = new RTCPeerConnection();
		}
		this.rtcPeerConnections[newUser].setRemoteDescription(offer).then(() => {
			this.rtcPeerConnections[newUser].createAnswer().then(answer => {
				this.rtcPeerConnections[newUser].setLocalDescription(answer).then(() => {
					this.wssClient.sendJSON({
						type: "RTCPeerAnswer",
						// channel: this.channel,
						answer: this.rtcPeerConnections[newUser].localDescription.toJSON()
					});

				});
			});
		}).catch(error =>
			console.error(error, offer)
		);
		this.rtcPeerConnections[newUser].ontrack = (event) => {
			// if (event.track.kind === "audio") {
			// 	console.log("Received audio MediaStreamTrack");
			// }
			// else {
			console.log(this.rtcPeerConnections, newUser)
				this.videoTrack(event.streams);
			// }
		};
	}
	
	/**
	 * @param {RTCSessionDescription} answer 
	 * @param {string} newUser 
	 */
	peerAnswer(answer: RTCSessionDescription, newUser: string) {
		// this.rtcPeerConnections[newUser] = this.rtcPeerConnections[Login._user];
		// this.rtcPeerConnections[Login._user] = new RTCPeerConnection();
		console.log(this.rtcPeerConnections, newUser);

		this.rtcPeerConnections[Login._user].setRemoteDescription(answer).then(
			// console.info("RTCPeerConnection established")
		).catch(error =>
			console.error(error, answer)
		);
		this.rtcPeerConnections[Login._user].addEventListener("icecandidate", (event) => {
			console.info("New IceCandidate", event.candidate);
			if (event.candidate) {
				this.wssClient.sendJSON({
					type: "IceCandidate",
					// channel: this.channel,
					candidate: event.candidate.toJSON()
				});
			}
			else if (false && this.rtcPeerConnections[Login._user].iceConnectionState === "connected") {
				// this.rtcPeerConnections.push(new RTCPeerConnection());
				// // Login._user = this.rtcPeerConnections.length - 1;
				// this.start(videoTrack);
				// console.info("RTCPeerConnection is done, moving on !");
			}
			else {
				// throw new TypeError("No candidate and not connected", event);
			}
		});
	}

	/**
	 * @param {RTCIceCandidate} candidate 
	 * @param {string} newUser 
	 */
	newCandidate(candidate: RTCIceCandidate, newUser: string) {
		this.rtcPeerConnections[newUser].addIceCandidate(candidate).then(
			// console.log("IceCandidate added")
			console.log(this.rtcPeerConnections, newUser)
		).catch(error =>
			console.error(error, candidate, this.rtcPeerConnections[newUser].localDescription)
		);
	}
}