const socket = new WebSocket('ws://localhost:3000/');

//handle messages from the server 
socket.onmessage = async function (message) { 
	var data = JSON.parse(await message.data.text());
	console.log("Got message", data);
	
//    switch(data.type) { 
//       case "login": 
//          onLogin(data.success); 
//          break; 
//       case "offer": 
//          onOffer(data.offer, data.name); 
//          break; 
//       case "answer": 
//          onAnswer(data.answer); 
//          break; 
//       case "candidate": 
//          onCandidate(data.candidate); 
//          break; 
//       default: 
//          break; 
//    } 
};
  
//when a user logs in 
// function onLogin(success) { 

//    if (success === false) { 
//       alert("oops...try a different username"); 
//    } else { 
//       //creating our RTCPeerConnection object 
		
//       var configuration = { 
//          "iceServers": [{ "url": "stun:stun.1.google.com:19302" }] 
//       }; 
		
//       myConnection = new webkitRTCPeerConnection(configuration); 
//       console.log("RTCPeerConnection object was created"); 
//       console.log(myConnection); 
  
//       //setup ice handling
//       //when the browser finds an ice candidate we send it to another peer 
//       myConnection.onicecandidate = function (event) { 
		
//          if (event.candidate) { 
//             send({ 
//                type: "candidate", 
//                candidate: event.candidate 
//             }); 
//          } 
//       }; 
//    } 
// };
  
  
socket.onerror = function (err) { 
   console.log("Got error", err); 
};

socket.onopen = () => {
	socket.send(JSON.stringify({
		type: "login",
		channel: "testChannel"
	}));
	socket.onopen = function () { 
	   console.log("Connected"); 
	};
};