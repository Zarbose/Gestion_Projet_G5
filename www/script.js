import { IceClient, WssClient } from "./Client.js";

let channel = "undefined";
let user = "local";
const login = (state) => {
	/**
	 * @param {string} id 
	 * @param {string} msg 
	 */
	function formWarning(id, msg) {
		const input = document.getElementById(id);
		input.setCustomValidity(msg);
		input.reportValidity();
		input.addEventListener("input", () => {
			input.setCustomValidity("");
			input.reportValidity();
		});

	}
	if (state === "success") {
		let form  = document.getElementById("choose");
		for (const element of form.elements) {
			element.disabled = true;
		}
	}
	else if (state === "user") {
		formWarning("newUser", "Nom d'utilisateur·rice déjà existant dans ce channel !");
	}
	else if (state === "incomplete") {
		formWarning("newChannel", "Le channel ne peut être vide !");
	}
	else {
		formWarning("newChannel", "Erreur lors de l'enregitrement !");
	}
};
const chat = (newUser, message) => {
	document.getElementById("chatText").insertAdjacentHTML("beforeend", `<span>${newUser}: ${message}`);
};
const videoTrack = (streams) => {
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

const iceClient = new IceClient();
const wssClient = new WssClient(iceClient);
iceClient.start(wssClient, videoTrack);
wssClient.start(login, chat);

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

document.getElementById("sendMessage").addEventListener("submit", () => {
	const message = document.getElementById("messageToSend").value;
	document.getElementById("chatText").insertAdjacentHTML("beforeend", `<span>${user}: ${message}`);
	wssClient.sendJSON({
		type: "message",
		message: message
	});
});

document.getElementById("choose").addEventListener("submit", () => {
	const existingChannels = document.getElementById("existingChannels").value;
	const newChannel = document.getElementById("newChannel").value;
	user = document.getElementById("newUser").value;
	if (!existingChannels.disabled) {
		channel = newChannel ? newChannel : existingChannels;
	}
	else {
		channel = newChannel;
	}
	wssClient.setLogin(channel, user);
	iceClient.setLogin(channel, user);
	wssClient.sendJSON({
		type: "login"
	});
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
			document.getElementById("newChannel").required = true;
		}
	});
});