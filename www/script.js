fetch(`${window.location.origin}/API?channels`).then(response => {
	const input = document.getElementById("existingChannels");
	response.json().then(json => {
		if (json.length != 0) {
			for (const channel of json) {
				input.insertAdjacentHTML("afterbegin", `<option value="${channel}">${channel}</option>`);
			}
		}
		else {
			input.disabled = true;
		}
	});
});

const socket = new WebSocket("ws://localhost:3000/");
let channel = "";

socket.onmessage = function (message) {
	message.data.text().then(string => {
		const data = JSON.parse(string);
	
		console.log("Got message", data);

		switch(data.type) {
		case "message":
			console.info(`Channel ${data.type}: ${data.message}`);
			break;
		case "RTCPeerOffer": {
			console.info(`Channel ${data.type}: RTCPeerOffer`, new RTCSessionDescription(data.offer));

			// const remoteConnection = new RTCPeerConnection();

			// 	remoteConnection.setRemoteDescription(data.candidate).then(() =>
			// 		navigator.mediaDevices.getUserMedia(mediaConstraints))
			// 	.then((stream) => {
			// 	  document.getElementById("local_video").srcObject = stream;
			// 	  return myPeerConnection.addStream(stream);
			// 	})
			// 	.then(() => myPeerConnection.createAnswer())
			// 	.then((answer) => myPeerConnection.setLocalDescription(answer))
			// 	.then(() => {
			// 	  // Send the answer to the remote peer using the signaling server
			// 	})
			// 	.catch(handleGetUserMediaError);
			// }


			const videoChannel = document.getElementById("videoChannel");
			const video = document.createElement("video");
			video.muted = true;
			video.controls = false;
			video.autoplay = true;
			video.srcObject = null;
			videoChannel.appendChild(video);
			break;
		}
		case "login":
			if (data.state === "success") {
				let form  = document.getElementById("choose");
				for (const element of form.elements) {
					element.disabled = true;
				}
			}
			else {
				const input = document.querySelector("form#choose input");
				input.setCustomValidity("Erreur lors de l'enregitrement de channel !");
				input.reportValidity();
			}
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


const localConnection = new RTCPeerConnection();
localConnection.addEventListener("icecandidate", (event) => {
	console.info(event);
});

socket.onerror = function (err) { 
	console.log("Got error", err); 
};
socket.onopen = function () { 
	console.log("Connected"); 
};

document.getElementById("choose").addEventListener("submit", () => {
	const existingChannels = document.getElementById("existingChannels").value;
	const newChannel = document.getElementById("newChannel").value;
	channel = !existingChannels ? newChannel : existingChannels;
	socket.send(JSON.stringify({
		type: "login",
		channel: channel
	}));
});

document.getElementById("send").addEventListener("submit", () => {
	const message = document.getElementById("message").value;
	socket.send(JSON.stringify({
		type: "message",
		channel: channel,
		message: message
	}));
});


navigator.mediaDevices.getUserMedia({
	video: {
		width: 800,
		height: 600,
		frameRate: {
			ideal: 25,
			max: 30
		}
	},
	audio: true
}).then(mediaStream => {
	const video = document.getElementById("webcam");
	video.muted = true;
	video.controls = false;
	video.autoplay = true;
	video.srcObject = mediaStream;
}).catch(error => {
	if (error.name === "NotAllowedError") {
		console.warn("Webcam", error.message);
	} else {
		throw error;
	}
});

document.getElementById("sendVideo").addEventListener("submit", () => {
	const video = document.getElementById("webcam");
	localConnection.addTrack(video.srcObject.getVideoTracks()[0]);

	localConnection.createOffer().then(offer => 
		localConnection.setLocalDescription(offer)
	).then(() => {
		socket.send(JSON.stringify({
			type: "RTCPeerOffer",
			channel: channel,
			offer: localConnection.localDescription.toJSON()
		}));
	});
});
