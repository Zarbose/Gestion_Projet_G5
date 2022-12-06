import { IceClient, WssClient } from "./Client.js";

let channel = "";
let login = (data) => {
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
};
let videoTrack = (streams) => {
	if (streams.length <= 0) throw new Error("Streams are empty !");
	const videoChannel = document.getElementById("videoChannel");
	const video = document.createElement("video");
	video.muted = false;
	video.controls = false;
	video.autoplay = true;
	video.srcObject = streams[0];
	video.width = 400;
	video.height = 200;
	videoChannel.appendChild(video);
	console.info("New stream added in DOM");
};

const iceClient = new IceClient(channel);
const wssClient = new WssClient(iceClient);
iceClient.start(wssClient, videoTrack);
wssClient.start(login);

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
	iceClient.sendVideo(video.srcObject);
});

document.getElementById("send").addEventListener("submit", () => {
	const message = document.getElementById("message").value;
	wssClient.sendJSON({
		type: "message",
		channel: channel,
		message: message
	});
});

document.getElementById("choose").addEventListener("submit", () => {
	const existingChannels = document.getElementById("existingChannels").value;
	const newChannel = document.getElementById("newChannel").value;
	channel = !existingChannels ? newChannel : existingChannels;
	wssClient.sendJSON({
		type: "login",
		channel: channel
	});
	iceClient.channel = channel;
	wssClient.channel = channel;
});

fetch(`${window.location.origin}/API?channels`).then(response => {
	const input = document.getElementById("existingChannels");
	response.json().then(json => {
		if (json.length != 0) {
			for (const distantChannel of json) {
				input.insertAdjacentHTML("afterbegin", `<option value="${distantChannel}">${distantChannel}</option>`);
			}
		}
		else {
			input.disabled = true;
		}
	});
});