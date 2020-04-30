

var signalingSocket = new WebSocket("ws://192.168.100.3:8080");
signalingSocket.onopen = onSocketOpen;

var userName = "";

var globalUsers = {};

function onSocketOpen(event) {
    signalingSocket.onmessage = handleMessage;
}

async function initCallRequest(users) {
    for (const user of users) {
        globalUsers[user] = new RTCPeerConnection();
        globalUsers[user].ontrack = onTrack;
        const {track, stream} = await getVideoTrackAndStream();
        globalUsers[user].addTrack(track, stream);
        await globalUsers[user].setLocalDescription(await globalUsers[user].createOffer());
        const msg = {
            event: "init_call_req",
            body: {
                from: userName,
                to: user,
                sdp: globalUsers[user].localDescription
            }
        }
        signalingSocket.send(JSON.stringify(msg));
    }
}

async function onTrack({track, streams}) {
    track.onunmute = () => {
        document.querySelector("#video-frame").srcObject = streams[0];
    }
}

async function makeAnswer(user, sdp) {
    if (!globalUsers[user]) {
        globalUsers[user] = new RTCPeerConnection();
        globalUsers[user].ontrack = onTrack;
        const {track, stream} = await getVideoTrackAndStream();
        globalUsers[user].addTrack(track, stream);
    }
    await globalUsers[user].setRemoteDescription(sdp);
    await globalUsers[user].setLocalDescription(await globalUsers[user].createAnswer());
    const msg = {
        event: "offer_resp",
        body: {
            from: userName,
            to: user,
            sdp: globalUsers[user].localDescription
        }
    }
    signalingSocket.send(JSON.stringify(msg));
}

async function setRemoteSDP(user, sdp) {
    await globalUsers[user].setRemoteDescription(sdp);
}

function handleMessage(message) {
    const msg = JSON.parse(message.data);
    console.log("new message: ", msg);
    switch (msg.event) {
    case "conn_resp":
        initCallRequest(msg.body.users);
        break;  
    case "offer_req":
        makeAnswer(msg.body.from, msg.body.sdp);
        break;
    case "init_call_resp":
        setRemoteSDP(msg.body.from, msg.body.sdp);
        break;
    }
        
}

function connectToConference(event) {
    if (signalingSocket.readyState == signalingSocket.CLOSED) {
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


async function getVideoTrackAndStream() {
    const constraints = {
        audio: false, 
        video: {
            width: 1270,
            height: 720,
            frameRate: 30
        }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const videoTracks = stream.getVideoTracks();
    return {track: videoTracks[0], stream: stream};
}

document.querySelector('#connect-btn').addEventListener('click', e => connectToConference(e));

var selfVideo = document.querySelector('#self-video');

window.onload = async () => {
    try{
        const {track, stream} = await getVideoTrackAndStream();
        selfVideo.srcObject = stream;
    }
    catch(error) {
        console.log("can't get access to camera, ", error);
    }

}