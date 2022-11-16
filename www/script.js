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

//handle messages from the server 
socket.onmessage = function (message) {
	message.data.text().then(string => {
		const data = JSON.parse(string);
	
		// console.log("Got message", data);

		switch(data.type) {
		case "message":
			console.info(`Channel ${data.type}: ${data.message}`);
			break;

		case "RTCPeerConnection":
			console.info(`Channel ${data.type}: RTCPeerConnection ${data.candidate}`);
			break;

		default:
			throw new Error(`Internal error, ${data.type} no action to be done`);
			// break;
		}
	});
};

socket.onerror = function (err) { 
	console.log("Got error", err); 
};
socket.onopen = function () { 
	console.log("Connected"); 
};

document.getElementById("choose").addEventListener("click", () => {
	const existingChannels = document.getElementById("existingChannels").value;
	const newChannel = document.getElementById("newChannel").value;
	channel = !existingChannels ? newChannel : existingChannels;
	socket.send(JSON.stringify({
		type: "login",
		channel: channel
	}));
});

document.getElementById("send").addEventListener("click", () => {
	const message = document.getElementById("message").value;
	socket.send(JSON.stringify({
		type: "message",
		channel: channel,
		message: message
	}));
});


const video = document.getElementById("webcam");
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

document.getElementById("sendVideo").addEventListener("click", () => {
	const localConnection = new RTCPeerConnection();
	localConnection.addTrack(video.srcObject.getVideoTracks()[0]);
	
	localConnection.createOffer().then(offer => {
		socket.send(JSON.stringify({
			type: "RTCPeerConnection",
			channel: channel,
			offer: offer
		}));
		localConnection.setLocalDescription(offer);
	});
});