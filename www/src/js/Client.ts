abstract class Login {
	protected static _channel: string;
	protected static _user: string;

	setLogin(channel: string, user: string) {
		Login._channel = channel;
		Login._user = user;
	}
}

export class WssClient extends Login {
	private _socket: WebSocket;
	private _iceClient: IceClient;

	constructor(iceClient: IceClient, ip = "localhost", port = 8443) {
		super();
		const url = new URL(`wss://${ip}:${port}/`);
		this._socket = new WebSocket(url);
		this._iceClient = iceClient;
	}

	/**
	 * @description WebSocket.send a String from a JSON
	 * @note Autocompletion with current channel and user
	 */
	sendJSON(json: object) {
		this._socket.send(
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
		this._socket.send(string);
	}

	start(login: (state: string) => void, chat: (newUser: string, message: string) => void) {
		this._socket.onmessage = (message) => {
			message.data.text().then((string: string) => {
				const data = JSON.parse(string);
		
				switch(data.type) {
				case "message":
					chat(data.user, data.message);
					break;
				case "RTCPeerOffer":
					this._iceClient.peerOffer(new RTCSessionDescription(data.offer), data.user);
					break;
				case "RTCPeerAnswer": {
					this._iceClient.peerAnswer(new RTCSessionDescription(data.answer), data.user);
					break;
				}
				case "IceCandidate": {
					this._iceClient.newCandidate(new RTCIceCandidate(data.candidate), data.user);
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
		this._socket.onerror = function (err) {
			console.warn("Got error", err); 
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
	private _rtcPeerConnections: RTCPeerConnectionDict = {};
	private _newStreamToAdd: (streams: readonly MediaStream[], newUser: string) => void;
	private _streamClosing: (newUser: string) => void;
	public wssClient!: WssClient;
	public srcObject!: MediaStream;

	constructor(newStreamToAdd: (streams: readonly MediaStream[], newUser: string) => void, streamClosing: (newUser: string) => void) {
		super();
		this._newStreamToAdd = newStreamToAdd;
		this._streamClosing = streamClosing;
	}

	private _sendRtcPeerOffer(newUser: string) {
		if (!this.srcObject) throw new ReferenceError("srcObject is empty !");
		if (!this.wssClient) throw new ReferenceError("wssClient is empty !");

		try {
			this._rtcPeerConnections[newUser].connection.addTrack(this.srcObject.getVideoTracks()[0], this.srcObject);
			this._rtcPeerConnections[newUser].connection.addTrack(this.srcObject.getAudioTracks()[0], this.srcObject);
		} catch (error) {
			this._rtcPeerConnections[newUser].fullfilled = false;
			throw new Error(`Already sent ${error}`);
		}
		console.info(this.srcObject.getTracks());

		this._rtcPeerConnections[newUser].connection.createOffer().then(offer => 
			this._rtcPeerConnections[newUser].connection.setLocalDescription(offer)
		).then(() => {
			console.info("Sending RTCPeerOffer to", newUser);
			this.wssClient.sendJSON({
				type: "RTCPeerOffer",
				recipient: newUser,
				offer: this._rtcPeerConnections[newUser].connection.localDescription?.toJSON()
			});
		});
	}

	private _initializeRTCPeerConnection(newUser: string) {
		if (Object.hasOwnProperty.call(this._rtcPeerConnections, newUser)) {
			if (this._rtcPeerConnections[newUser].fullfilled) {
				throw new Error(`${newUser} is already fullfilled`);
			}
			else this._rtcPeerConnections[newUser].fullfilled = true;
		}
		else {
			this._rtcPeerConnections[newUser] = {
				connection: new RTCPeerConnection(),
				fullfilled: false,
			};
			this._rtcPeerConnections[newUser].connection.addEventListener("icecandidate", (event) => {
				console.info("Sending new IceCandidate to", newUser, event.candidate);
				if (event.candidate) {
					this.wssClient.sendJSON({
						type: "IceCandidate",
						recipient: newUser,
						candidate: event.candidate.toJSON()
					});
				}
			});
			this._rtcPeerConnections[newUser].connection.ontrack = (event) => {
				if (event.track.kind === "audio") {
					console.log("Received audio MediaStreamTrack from", newUser);
					// TODO: integrate a distinct audio stream with an audio tag if time remains
				}
				else {
					this._newStreamToAdd(event.streams, newUser);
				}
			};
			this._rtcPeerConnections[newUser].connection.oniceconnectionstatechange = () => {
				if (this._rtcPeerConnections[newUser].connection.iceConnectionState === "disconnected") {
					this._streamClosing(newUser);
					this._rtcPeerConnections[newUser].connection.close();
					delete this._rtcPeerConnections[newUser];
				}
			};
			console.info(`${newUser} added in RTCPeerConnectionDict`);
		}
	}

	closeAll() {
		for (const rtcPeerConnection in this._rtcPeerConnections) {
			if (Object.prototype.hasOwnProperty.call(this._rtcPeerConnections, rtcPeerConnection)) {
				this._rtcPeerConnections[rtcPeerConnection].connection.close();
			}
		}
	}

	sendVideo() {
		fetch(`${window.location.origin}/API?users&channel=${Login._channel}`).then(response => {
			response.json().then(users => {
				users.forEach((user: string) => {
					if (user !== Login._user) {
						this._initializeRTCPeerConnection(user);
						this._sendRtcPeerOffer(user);
					}
				});
			});
		});
	}

	peerOffer(offer: RTCSessionDescription, newUser: string) {
		this._initializeRTCPeerConnection(newUser);

		this._rtcPeerConnections[newUser].connection.setRemoteDescription(offer).then(() => {
			this._rtcPeerConnections[newUser].connection.createAnswer().then(answer => {
				this._rtcPeerConnections[newUser].connection.setLocalDescription(answer).then(() => {
					this.wssClient.sendJSON({
						type: "RTCPeerAnswer",
						recipient: newUser,
						answer: this._rtcPeerConnections[newUser].connection.localDescription?.toJSON()
					});

				});
			});
		}).catch(error =>
			console.error(error, offer)
		);
	}

	peerAnswer(answer: RTCSessionDescription, newUser: string) {
		if (!Object.hasOwnProperty.call(this._rtcPeerConnections, newUser)) {
			throw new ReferenceError(`${newUser} is not in ${this._rtcPeerConnections}`);
		}
		else {
			this._rtcPeerConnections[newUser].connection.setRemoteDescription(answer).then(
				// console.info("RTCPeerConnection established with", newUser)
			).catch(error =>
				console.error(error, newUser, answer)
			);
		}		
	}

	newCandidate(candidate: RTCIceCandidate, newUser: string) {
		this._rtcPeerConnections[newUser].connection.addIceCandidate(candidate).then(
			// console.info("IceCandidate added of", newUser)
		).catch(error =>
			console.error(error, candidate, this._rtcPeerConnections[newUser].connection.localDescription)
		);
	}
}