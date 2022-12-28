import { IceClient, WssClient } from "./Client.js";

let channel = "undefined";
let user = "local";
const login = (state :string) => {
	function formWarning(id: string, msg: string) {
		const input = document.getElementById(id) as HTMLInputElement;
		input.setCustomValidity(msg);
		input.reportValidity();
		input.addEventListener("input", () => {
			input.setCustomValidity("");
			input.reportValidity();
		});

	}
	if (state === "success") {
		const form  = document.getElementById("choose") as HTMLFormElement;
		for (const element of form.elements) {
			(element as HTMLInputElement|HTMLSelectElement).disabled = true;
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
const chat = (newUser: string, message: string) => {
	if (message == "entering"){
		document.getElementById("chatText").insertAdjacentHTML("afterbegin", `<div class="infoMessage" style="color: green"><small>&#10132; ${newUser} est entrée</small></div>`);
	}
	else if(message == "leaving"){
		document.getElementById("chatText").insertAdjacentHTML("afterbegin", `<div class="infoMessage" style="color: red"><small>&#10132; ${newUser} est sortie</small></div>`);
	}
	else{
		if (newUser == user){
			document.getElementById("chatText").insertAdjacentHTML("afterbegin", `<div class="message messageSend">${message}</div>`);
		}
		else{
			document.getElementById("chatText").insertAdjacentHTML("afterbegin", `<div class="message"><small>~ ${newUser}<br/></small>${message}</div>`);
		}
	}
};
const videoTrack = (streams: MediaStream[], newUser: string) => { //TODO: distant user login displayed
	if (streams.length <= 0) throw new Error("Streams are empty !");
	const videoChannel = document.getElementById("videoChannel");
	const video = document.createElement("video");
	video.muted = false; //TODO: Mute/Unmute controls
	video.controls = false;
	video.autoplay = true;
	video.srcObject = streams[0];
	video.width = 400;
	video.height = 200;
	videoChannel.appendChild(video);
	console.info("New stream added in DOM");
};


const iceClient = new IceClient(videoTrack);
let wssClient: WssClient;
fetch(`${window.location.origin}/src/WebSocketConfig.json`).then(response => {
	response.json().then(config => {
		wssClient = new WssClient(iceClient, config.ip, config.port);
	});
}).catch(error => {
	wssClient = new WssClient(iceClient);
	console.warn(error);
});

iceClient.wssClient = wssClient;
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
	const video = document.getElementById("webcam") as HTMLVideoElement;
	video.muted = true;
	video.controls = false;
	video.autoplay = true;
	video.srcObject = mediaStream;
	iceClient.srcObject = mediaStream;
}).catch(error => {
	if (error.name === "NotAllowedError") {
		console.warn("Webcam", error.message);
	} else {
		throw error;
	}
});

document.getElementById("sendVideo").addEventListener("submit", () => {
	iceClient.sendVideo();
});

document.getElementById("sendMessage").addEventListener("submit", () => {
	const message = (document.getElementById("messageToSend") as HTMLInputElement).value;
	chat(user, message);
	wssClient.sendJSON({
		type: "message",
		message: message
	});
});

document.getElementById("choose").addEventListener("submit", () => {
	const existingChannels = document.getElementById("existingChannels") as HTMLSelectElement;
	const newChannel = (document.getElementById("newChannel") as HTMLInputElement).value;
	user = (document.getElementById("newUser") as HTMLInputElement).value;
	if (!existingChannels.disabled) {
		channel = newChannel ? newChannel : existingChannels.value;
	}
	else {
		channel = newChannel;
	}
	wssClient.setLogin(channel, user);
	iceClient.setLogin(channel, user);
	wssClient.sendJSON({
		type: "login"
	});
	const message = "entering";
	chat(user, message);
	wssClient.sendJSON({
		type: "message",
		message: message
	});
});

fetch(`${window.location.origin}/API?channels`).then(response => {
	const input = document.getElementById("existingChannels") as HTMLInputElement;
	response.json().then(json => {
		if (json.length != 0) {
			for (const distantChannel of json) {
				input.insertAdjacentHTML("afterbegin", `<option value="${distantChannel}">${distantChannel}</option>`);
			}
		}
		else {
			input.disabled = true;
			(document.getElementById("newChannel") as HTMLInputElement).required = true;
		}
	});
});

window.addEventListener("beforeunload", () => {
	const message = "leaving";
	chat(user, message);
	wssClient.sendJSON({
		type: "message",
		message: message
	});
}); 