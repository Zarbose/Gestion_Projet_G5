import { IceClient, WssClient } from "./Client.js";

let channel = "N/A";
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
		(document.getElementById("chatText") as HTMLDivElement).insertAdjacentHTML("afterbegin", `<div class="infoMessage" style="color: green"><small>&#10132; ${newUser} est entrée</small></div>`);
	}
	else if(message == "leaving"){
		(document.getElementById("chatText") as HTMLDivElement).insertAdjacentHTML("afterbegin", `<div class="infoMessage" style="color: red"><small>&#10132; ${newUser} est sortie</small></div>`);
	}
	else{
		if (newUser == user){
			(document.getElementById("chatText") as HTMLDivElement).insertAdjacentHTML("afterbegin", `<div class="message messageSend">${message}</div>`);
		}
		else{
			(document.getElementById("chatText") as HTMLDivElement).insertAdjacentHTML("afterbegin", `<div class="message"><small>~ ${newUser}<br/></small>${message}</div>`);
		}
	}
};
const videoTrack = (streams: readonly MediaStream[], newUser: string) => { //TODO: distant user login displayed
	if (streams.length <= 0) throw new Error("Streams are empty !");
	const videoChannel = document.getElementById("videoChannel") as HTMLDivElement;
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


let wssClient: WssClient;
const iceClient = new IceClient(videoTrack);
fetch(`${window.location.origin}/src/WebSocketConfig.json`).then(response => {
	response.json().then(config => {
		wssClient = new WssClient(iceClient, config.ip, config.port);
		iceClient.wssClient = wssClient;
		wssClient.start(login, chat);
	});
}).catch(error => {
	wssClient = new WssClient(iceClient);
	iceClient.wssClient = wssClient;
	wssClient.start(login, chat);
	console.warn(error);
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
	const video = document.getElementById("webcam") as HTMLVideoElement;
	video.muted = true;
	video.controls = false;
	video.autoplay = true;
	video.srcObject = mediaStream;
	iceClient.srcObject = mediaStream;
}).catch(error => {
	if (error.name === "NotAllowedError") {
		console.warn("Webcam", error.message);
		alert("Cette aplication web ne peut pas entièrement fonctionner sans les autorisations pour accéder à la webcam et son audio.");
	} else {
		throw error;
	}
});

(document.getElementById("sendVideo") as HTMLFormElement).addEventListener("submit", () => {
	iceClient.sendVideo();
});

(document.getElementById("sendMessage") as HTMLFormElement).addEventListener("submit", () => {
	const message = (document.getElementById("messageToSend") as HTMLInputElement).value;
	chat(user, message);
	wssClient.sendJSON({
		type: "message",
		message: message
	});
});

(document.getElementById("choose") as HTMLFormElement).addEventListener("submit", () => {
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