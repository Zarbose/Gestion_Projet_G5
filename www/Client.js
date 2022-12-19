/**
 * @abstract
 */
class Login {
	_channel = "";
	_user = "";

	/**
	 * @param {string} channel 
	 * @param {string} user 
	 */
	setLogin(channel, user) {
		this._channel = channel;
		this._user = user;
	}
}

export class WssClient extends Login {
	/**
	 * @type {WebSocket}
	 */
	#socket;
	/**
	 * @type {IceClient}
	 */
	#iceClient;

	/**
	 * @param {IceClient} iceClient 
	 * @param {string} [ip] server
	 * @param {int} [port] server
	 */
	constructor(iceClient, ip = "localhost", port = 8443) {
		super();
		const url = new URL(`wss://${ip}:${port}/`);
		this.#socket = new WebSocket(url);
		this.#iceClient = iceClient;
	}

	/**
	 * @description WebSocket.send a String from a JSON
	 * @note Autocompletion with current channel and user
	 * @param {Object} json 
	 */
	sendJSON(json) {
		this.#socket.send(
			JSON.stringify(Object.assign({
				channel: this._channel,
				user: this._user,
			}, json))	
		);
	}

	/**
	 * @description WebSocket.send
	 * @note No channel nor user
	 * @param {string} json 
	 */
	send(string) {
		this.#socket.send(string);
	}

	/**
	 * @param {function(string): void} login Frontend function to be called when connected
	 * @param {function(string, string): void} chat Frontend function to be called when a chat arrives
	 */
	start(login, chat) {
		const globalThis = this;
		this.#socket.onmessage = function (message) {
			message.data.text().then(string => {
				const data = JSON.parse(string);
			
				console.info("Socket received", data.type);
		
				switch(data.type) {
				case "message":
					chat(data.user, data.message);
					break;
				case "RTCPeerOffer":
					// console.log(`Channel ${data.type}: RTCPeerOffer`, new RTCSessionDescription(data.offer));
					globalThis.#iceClient.peerOffer(new RTCSessionDescription(data.offer), data.user);
					break;
				case "RTCPeerAnswer": {
					globalThis.#iceClient.peerAnswer(new RTCSessionDescription(data.answer), data.user);
					break;
				}
				case "IceCandidate": {
					globalThis.#iceClient.newCandidate(new RTCIceCandidate(data.candidate), data.user);
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
		this.#socket.onerror = function (err) {
			console.warn("Got error", err); 
		};
		this.#socket.onopen = function () { 
			console.log("Connected");
		};
	}

}

export class IceClient extends Login {
	/**
	 * @type {Object[RTCPeerConnection]}
	 */
	#rtcPeerConnections = {};
	/**
	 * @type {WssClient}
	 */
	#wssClient;

	/**
	 * @param {WssClient} wssClient 
	 */
	set wssClient(wssClient) {
		this.#wssClient = wssClient;
	}

	constructor() {
		super();
	}

	/**
	 * @param {function(MediaStreamTrack[]): void} videoTrack Frontend function to be called when new video stream arrives
	 */
	start(videoTrack) {
		this.videoTrack = videoTrack;
		
	}

	/**
	 * @param {MediaStream} srcObject 
	 */
	sendVideo(srcObject) {
		// FIXME: this._user is initiliased only when setLogin is called
		this.#rtcPeerConnections[this._user] = new RTCPeerConnection();
		console.log(srcObject.getTracks());
		this.#rtcPeerConnections[this._user].addTrack(srcObject.getVideoTracks()[0], srcObject);
		this.#rtcPeerConnections[this._user].addTrack(srcObject.getAudioTracks()[0], srcObject);

		this.#rtcPeerConnections[this._user].createOffer().then(offer => 
			this.#rtcPeerConnections[this._user].setLocalDescription(offer)
		).then(() => {
			this.#wssClient.sendJSON({
				type: "RTCPeerOffer",
				offer: this.#rtcPeerConnections[this._user].localDescription.toJSON()
			});
		});

	}

	/**
	 * @param {RTCSessionDescription} offer 
	 * @param {string} newUser 
	 */
	peerOffer(offer, newUser) {
		if (!Object.hasOwnProperty.call(this.#rtcPeerConnections, newUser)) {
			// FIXME: when already connected to newUsers the this._user is already initiliased
			if (!this.#rtcPeerConnections[this._user]) this.#rtcPeerConnections[this._user] = new RTCPeerConnection();
			this.#rtcPeerConnections[newUser] = this.#rtcPeerConnections[this._user];
			this.#rtcPeerConnections[this._user] = new RTCPeerConnection();
		}
		this.#rtcPeerConnections[newUser].setRemoteDescription(offer).then(() => {
			this.#rtcPeerConnections[newUser].createAnswer().then(answer => {
				this.#rtcPeerConnections[newUser].setLocalDescription(answer).then(() => {
					this.#wssClient.sendJSON({
						type: "RTCPeerAnswer",
						// channel: this.channel,
						answer: this.#rtcPeerConnections[newUser].localDescription.toJSON()
					});

				});
			});
		}).catch(error =>
			console.error(error, offer)
		);
		this.#rtcPeerConnections[newUser].ontrack = (event) => {
			if (event.track.kind === "audio") {
				console.log("Received audio MediaStreamTrack");
			}
			else {
				this.videoTrack(event.streams);
			}
		};
	}
	
	/**
	 * @param {RTCSessionDescription} answer 
	 * @param {string} newUser 
	 */
	peerAnswer(answer, newUser) {
		this.#rtcPeerConnections[newUser] = this.#rtcPeerConnections[this._user];
		this.#rtcPeerConnections[this._user] = new RTCPeerConnection();

		this.#rtcPeerConnections[newUser].setRemoteDescription(answer).then(
			console.info("RTCPeerConnection established")
		).catch(error =>
			console.error(error, answer)
		);
		this.#rtcPeerConnections[newUser].addEventListener("icecandidate", (event) => {
			console.info("New IceCandidate", event.candidate);
			if (event.candidate) {
				this.#wssClient.sendJSON({
					type: "IceCandidate",
					// channel: this.channel,
					candidate: event.candidate.toJSON()
				});
			}
			else if (false && this.#rtcPeerConnections[this._user].iceConnectionState === "connected") {
				this.#rtcPeerConnections.push(new RTCPeerConnection());
				// this._user = this.#rtcPeerConnections.length - 1;
				this.start(videoTrack);
				console.info("RTCPeerConnection is done, moving on !");
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
	newCandidate(candidate, newUser) {
		this.#rtcPeerConnections[newUser].addIceCandidate(candidate).then(
			console.log("IceCandidate added")
		).catch(error =>
			console.error(error, candidate, this.#rtcPeerConnections[newUser].localDescription)
		);
	}
}