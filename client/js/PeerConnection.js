
import peerConnections from "./main.js"
import {userName, signalingSocket} from "./main.js";

export async function getVideoTrackAndStream() {
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

class PeerConnection {
    constructor(options) {
        this._impolite = options.impolite || false;
        this._makingOffer = false;
        this._peerName = options.peerName || "";
        this._videoFrame = options.videoFrame;

        peerConnections[this._peerName] = this;
        this._pc = new RTCPeerConnection();

        const {track, stream} = getVideoTrackAndStream().then(({track, stream}) => {
            this._pc.addTrack(track, stream);
        });


        this._pc.ontrack = this._onTrack.bind(this);
        this._pc.onnegotiationneeded = this._handleNegotiationNeededEvent.bind(this);
        this._pc.onicecandidate = this._onIceCandidate.bind(this);
    }

    getVideoFrame() {
        return this._videoFrame;
    }

    async makeAnswer(sdp) {
        const dropOffer = !this._impolite && (this._makingOffer || this._pc.signalingState !== "stable");
        if (dropOffer) {
            return;
        }
        await this._pc.setRemoteDescription(sdp);
        await this._pc.setLocalDescription(await this._pc.createAnswer());
        const msg = {
            event: "offer_resp",
            body: {
                from: userName,
                to: this._peerName,
                sdp: this._pc.localDescription
            }
        }
        signalingSocket.send(JSON.stringify(msg));
    }

    async _handleNegotiationNeededEvent() {
        console.log("handle negotiation needed event");
        console.log("this: ", this);
        this._makingOffer = true;
        await this._pc.setLocalDescription(await this._pc.createOffer());
        const msg = {
            event: "init_call_req",
            body: {
                from: userName,
                to: this._peerName,
                sdp: this._pc.localDescription
            }
        }
        signalingSocket.send(JSON.stringify(msg));
        this._makingOffer = false;
    }

    async _onIceCandidate(event) {
        if (!event.candidate) {
            return;
        }
        const msg = {
            event: "new_ice_cand_req",
            body: {
                from: userName,
                to: this._peerName,
                candidate: event.candidate
            }
        }
        signalingSocket.send(JSON.stringify(msg));
        console.log("new candidate: " + event.candidate);
    }

    async _onTrack({track, streams}) {
        track.onunmute = () => {
            console.log("on unmute");
            this._videoFrame.srcObject = streams[0];
        }

        track.onmute = () => {
            console.log("on mute");
        }
    }

    async setRemoteSDP(sdp) {
        try {
            await this._pc.setRemoteDescription(sdp);
        } catch(error) {
            console.log("Error while setting remote description: ", error);
        }

    }

    async addRemoteCandidate(candidate) {
        console.log("new ice candidate from " + this._peerName);
        const newCandidate = new RTCIceCandidate(candidate);
        this._pc.addIceCandidate(newCandidate).catch(err => console.log("error on add candidate: " + err));
    }
}

export default PeerConnection;
