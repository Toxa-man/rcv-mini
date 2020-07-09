// export const signalingSocket = new WebSocket("wss://rcv-mini.com:8443");
export const signalingSocket = new WebSocket("wss://192.168.0.169:8443");
signalingSocket.onopen = onSocketOpen;
signalingSocket.onclose = () => console.log("Connection closed");

import PeerConnection from "./PeerConnection.js";
import {getVideoTrackAndStream} from "./PeerConnection.js";

export let userName = "";

const peerConnections = {};

function onSocketOpen(event) {
    signalingSocket.onmessage = handleMessage;
}

function recalculateGallery() {
    const size = Object.keys(peerConnections).length;
    const rows = Math.round(Math.sqrt(size));
    const columns = Math.trunc(size / rows);
    const width = 1860;
    const curWidth = width / columns;
    const startHeight = 100;
    for (let row = 0; row < rows + 1; row++) {
        for (let column = 0; column < columns; column++) {
            const videoFrame = Object.values(peerConnections)[row * columns + column]?.getVideoFrame();
            if (!videoFrame) {
                return;
            }
            videoFrame.setAttribute("width", curWidth);
            videoFrame.setAttribute("height", curWidth);
            const left = (column * curWidth).toString() + "px";
            const top = (startHeight + row * curWidth).toString() + "px";
            videoFrame.style.left = left;
            videoFrame.style.top = top;
        }
    }

}

function createVideoFrame(peerName) {
    const frame = document.createElement("video");
    frame.setAttribute("id", "video-frame-" + peerName);
    frame.setAttribute("autoplay", "");
    frame.setAttribute("playsinline", "");
    frame.style.position = "absolute";
    frame.style.border = "thin solid";
    document.querySelector("#participant-vids").appendChild(frame);
    return frame;
}

function createPeerConnections(users) {
    for (const user of users) {
        const frame = createVideoFrame(user);
        document.querySelector("#participant-vids").appendChild(frame);
        new PeerConnection({
            peerName: user,
            impolite: true,
            videoFrame: frame
        });
    }
    recalculateGallery();
}

function handleMessage(message) {
    const msg = JSON.parse(message.data);
    console.log("new message: ", msg);
    switch (msg.event) {
    case "conn_resp":
        createPeerConnections(msg.body.users);
        break;  
    case "offer_req":
        const peerName = msg.body.from;
        const peerConnection = (() => {
            if (peerConnections[peerName]) {
                return peerConnections[peerName];
            } else {
                const frame = createVideoFrame(peerName);
                document.querySelector("#participant-vids").appendChild(frame);
                const pc = new PeerConnection({
                    peerName: peerName,
                    impolite: false,
                    videoFrame: frame
                });
                recalculateGallery();
                return pc;
            }
        })();
        peerConnection.makeAnswer(msg.body.sdp);
        break;
    case "init_call_resp":
        peerConnections[msg.body.from].setRemoteSDP(msg.body.sdp);
        break;
    case "new_remote_ice_req":
        peerConnections[msg.body.from].addRemoteCandidate(msg.body.candidate);
        break;
    }
        
}

function connectToConference(event) {
    if (signalingSocket.readyState === signalingSocket.CLOSED) {
        console.log("Cannot open web socket connection");
        return;
    }

    userName = document.querySelector("#username").value;
    const conf_id = document.querySelector("#conf-id").value;
    if (!userName || !conf_id) {
        console.log("Some input field arent filled");
        return;
    }


    const msg = {
        event: "conn_req",
        body: {
            from: userName,
            conf_id: conf_id
        }
    };
    signalingSocket.send(JSON.stringify(msg));
}



document.querySelector('#connect-btn').addEventListener('click', e => connectToConference(e));

const selfVideo = document.querySelector('#self-video');

window.onload = async () => {
    document.querySelector('#username').value = Math.random().toString(36).substring(3, 6);
    document.querySelector('#conf-id').value = "123";
    try{
        const {track, stream} = await getVideoTrackAndStream();
        selfVideo.srcObject = stream;
    }
    catch(error) {
        console.log("can't get access to camera, ", error);
    }

}

export default peerConnections;