export class WssClient {
	#socket = WebSocket;
	#iceClient = IceClient;
	channel = "";

	/**
	 * @param {IceClient} iceClient 
	 * @param {string} [ip] server
	 * @param {int} [port] server
	 */
	constructor(iceClient, ip = "localhost", port = 8443) {
		const url = new URL(`wss://${ip}:${port}/`);
		this.#socket = new WebSocket(url);
		this.#iceClient = iceClient;
	}

	/**
	 * @description WebSocket.send a String from a JSON
	 * @param {Object} json 
	 */
	sendJSON(json) {
		this.#socket.send(
			JSON.stringify(
				json
			)	
		);
	}

	/**
	 * @description WebSocket.send
	 * @param {string} json 
	 */
	send(string) {
		this.#socket.send(string);
	}

	/**
	 * @param {function(data): void} login Frontend function to be called when connected
	 */
	start(login) {
		const globalThis = this;
		this.#socket.onmessage = function (message) {
			message.data.text().then(string => {
				const data = JSON.parse(string);
			
				console.info("Socket received", data.type);
		
				switch(data.type) {
				case "message":
					console.info(`Channel ${data.type}: ${data.message}`);
					break;
				case "RTCPeerOffer":
					// console.log(`Channel ${data.type}: RTCPeerOffer`, new RTCSessionDescription(data.offer));
					globalThis.#iceClient.peerOffer(new RTCSessionDescription(data.offer));
					break;
				case "RTCPeerAnswer": {
					globalThis.#iceClient.peerAnswer(new RTCSessionDescription(data.answer));
					break;
				}
				case "IceCandidate": {
					globalThis.#iceClient.newCandidate(new RTCIceCandidate(data.candidate));
					break;
				}
				case "login":
					login(data);
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
			console.log("Got error", err); 
		};
		this.#socket.onopen = function () { 
			console.log("Connected");
		};
	}

}

export class IceClient {
	#rtcPeerConnection = new RTCPeerConnection();
	#wssClient = WssClient;
	channel = "";

	/**
	 * @param {string} channel 
	 */
	constructor(channel) {
		this.channel = channel;
	}

	/**
	 * @param {WssClient} wssClient 
	 * @param {function(MediaStreamTrack[]): void} videoTrack Frontend function to be called when new video stream arrives
	 */
	start(wssClient, videoTrack) {
		this.#wssClient = wssClient;
		this.#rtcPeerConnection.addEventListener("icecandidate", (event) => {
			console.info("New IceCandidate", event.candidate);
			if (event.candidate) {
				this.#wssClient.sendJSON({
					type: "IceCandidate",
					channel: this.channel,
					candidate: event.candidate.toJSON()
				});
			}
		});
		this.#rtcPeerConnection.ontrack = (event) => {
			if (event.track.kind === "audio") {
				console.log("Received audio MediaStreamTrack");
			}
			else {
				videoTrack(event.streams);
			}
		};
	}

	/**
	 * @param {MediaStream} srcObject 
	 */
	sendVideo(srcObject) {
		this.#rtcPeerConnection.addTrack(srcObject.getVideoTracks()[0], srcObject);
		console.log(srcObject.getTracks());
		this.#rtcPeerConnection.addTrack(srcObject.getAudioTracks()[0], srcObject);

		this.#rtcPeerConnection.createOffer().then(offer => 
			this.#rtcPeerConnection.setLocalDescription(offer)
		).then(() => {
			this.#wssClient.sendJSON({
				type: "RTCPeerOffer",
				channel: this.channel,
				offer: this.#rtcPeerConnection.localDescription.toJSON()
			});
		});

	}

	/**
	 * @param {RTCSessionDescription} offer 
	 */
	peerOffer(offer) {
		this.#rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(offer)).then(() => {
			this.#rtcPeerConnection.createAnswer().then(answer => {
				this.#rtcPeerConnection.setLocalDescription(answer).then(() => {
					this.#wssClient.sendJSON({
						type: "RTCPeerAnswer",
						channel: this.channel,
						answer: this.#rtcPeerConnection.localDescription.toJSON()
					});
				});
			});
		}).catch(error =>
			console.error(error, new RTCSessionDescription(offer))
		);
	}
	
	/**
	 * @param {RTCSessionDescription} answer 
	 */
	peerAnswer(answer) {
		this.#rtcPeerConnection.setRemoteDescription(answer).then(() => {
			console.info("RTCPeerConnection established");
		}).catch(error =>
			console.error(error, answer)
		);
	}

	/**
	 * @param {RTCIceCandidate} candidate 
	 */
	newCandidate(candidate) {
		this.#rtcPeerConnection.addIceCandidate(candidate).then(
			console.log("IceCandidate added")
		).catch(error =>
			console.error(error, candidate, this.#rtcPeerConnection.localDescription)
		);
	}
}