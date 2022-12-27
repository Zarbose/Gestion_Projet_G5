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
	[index: string]: {
		connection: RTCPeerConnection,
		fullfilled: boolean
	};
}

export class IceClient extends Login {
	private rtcPeerConnections: RTCPeerConnectionDict = {};
	private wssClient: WssClient;
	private videoTrack: (arg0: readonly MediaStream[]) => void;
	private srcObject: MediaStream;


	// set wssClient(wssClient: WssClient) {
	// 	this.wssClient = wssClient;
	// }

	constructor() {
		super();
	}

	start(videoTrack: (arg0: readonly MediaStream[]) => void, srcObject: MediaStream) {
		this.videoTrack = videoTrack;
		this.srcObject = srcObject;
		
	}

	private _sendRtcPeerOffer(user: string) {
		console.log(this.srcObject.getTracks());
		this.rtcPeerConnections[user].connection.addTrack(this.srcObject.getVideoTracks()[0], this.srcObject);
		this.rtcPeerConnections[user].connection.addTrack(this.srcObject.getAudioTracks()[0], this.srcObject);

		this.rtcPeerConnections[user].connection.createOffer().then(offer => 
			this.rtcPeerConnections[user].connection.setLocalDescription(offer)
		).then(() => {
			this.wssClient.sendJSON({
				type: "RTCPeerOffer",
				offer: this.rtcPeerConnections[user].connection.localDescription.toJSON()
			});
		});
	}

	sendVideo() {
		let called = false;
		for (const user in this.rtcPeerConnections) {
			if (Object.prototype.hasOwnProperty.call(this.rtcPeerConnections, user)) {
				if (!this.rtcPeerConnections[user].fullfilled) {
					this._sendRtcPeerOffer(user);
					this.rtcPeerConnections[user].fullfilled = true;
					called = true;
				}
			}
		}
		if (!called) {
			this.rtcPeerConnections[Login._user] = {
				connection: new RTCPeerConnection(),
				fullfilled: false,
			};
			this._sendRtcPeerOffer(Login._user);
		}
	}

	peerOffer(offer: RTCSessionDescription, newUser: string) {
		if (!Object.hasOwnProperty.call(this.rtcPeerConnections, newUser)) {
			console.info(`${newUser} added in RTCPeerConnectionDict`);
			this.rtcPeerConnections[newUser] = {
				connection: new RTCPeerConnection(),
				fullfilled: false
			};
		}
		this.rtcPeerConnections[newUser].connection.addEventListener("icecandidate", (event) => {
			console.info("Sending new IceCandidate", event.candidate);
			if (event.candidate) {
				this.wssClient.sendJSON({
					type: "IceCandidate",
					candidate: event.candidate.toJSON()
				});
			}
		});
		this.rtcPeerConnections[newUser].connection.setRemoteDescription(offer).then(() => {
			this.rtcPeerConnections[newUser].connection.createAnswer().then(answer => {
				this.rtcPeerConnections[newUser].connection.setLocalDescription(answer).then(() => {
					this.wssClient.sendJSON({
						type: "RTCPeerAnswer",
						answer: this.rtcPeerConnections[newUser].connection.localDescription.toJSON()
					});

				});
			});
		}).catch(error =>
			console.error(error, offer)
		);
		this.rtcPeerConnections[newUser].connection.ontrack = (event) => {
			if (event.track.kind === "audio") {
				console.log("Received audio MediaStreamTrack");
			}
			else {
				this.videoTrack(event.streams);
			}
		};
	}

	peerAnswer(answer: RTCSessionDescription, newUser: string) {
		console.log(this.rtcPeerConnections);
		if (!Object.hasOwnProperty.call(this.rtcPeerConnections, newUser)) {
			this.rtcPeerConnections[newUser] = this.rtcPeerConnections[Login._user];
			this.rtcPeerConnections[Login._user] = {
				connection: new RTCPeerConnection(),
				fullfilled: false
			};
			this.rtcPeerConnections[Login._user].connection.setLocalDescription(
				this.rtcPeerConnections[newUser].connection.localDescription
				// FIXME: not working -> the server needs to send the list of user in a channel and then dispatch all the offer that the client will generate on that list
			).then(() => {
				this.rtcPeerConnections[newUser].connection.setRemoteDescription(answer).then(
					// console.info("RTCPeerConnection established", this.rtcPeerConnections)
				).catch(error =>
					console.error(error, newUser, answer)
				);			
			});
		}
		else {
			this.rtcPeerConnections[newUser].connection.setRemoteDescription(answer).then(
				// console.info("RTCPeerConnection established", this.rtcPeerConnections)
			).catch(error =>
				console.error(error, newUser, answer)
			);
		}

		console.log(this.rtcPeerConnections, newUser);
		
	}

	newCandidate(candidate: RTCIceCandidate, newUser: string) {
		this.rtcPeerConnections[newUser].connection.addIceCandidate(candidate).then(
			// console.log("IceCandidate added", this.rtcPeerConnections)
		).catch(error =>
			console.error(error, candidate, this.rtcPeerConnections[newUser].connection.localDescription)
		);
	}
}