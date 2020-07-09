const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');

const server = https.createServer({
  cert: fs.readFileSync('../client/cert/cert.pem'),
  key: fs.readFileSync('../client/cert/key.pem')
});

server.listen(port = 8443, hostname = '0.0.0.0');

const wss = new WebSocket.Server({ server: server});

console.log("started");

var users = {};

function handleConnectionRequest(ws, userName) {
    console.log("Connection request from " + userName);
    users[userName] = ws;
    const usersList = Object.keys(users).filter(user => user !== userName);
    const msg = {
        event: "conn_resp",
        body: {
            users: usersList
        }
    }
    users[userName].send(JSON.stringify(msg));
}

function requestSDP(body) {
    console.log("offer request from " + body.from + " to " + body.to);
    const msg = {
        event: "offer_req",
        body: body
    }

    users[body.to].send(JSON.stringify(msg));
}

function initCallResponse(body) {
    console.log("init call response from " + body.from + " to " + body.to);
    const msg = {
        event: "init_call_resp",
        body: body
    }

    users[body.to].send(JSON.stringify(msg));
}

function forwardIceCandidate(body) {
    console.log("forward ice candidate from " + body.from + " to " + body.to);
    const msg = {
        event: "new_remote_ice_req",
        body: body
    }

    users[body.to].send(JSON.stringify(msg));
}


function handleMessage(ws, message) {
    const msg = JSON.parse(message);
    switch (msg.event) {
    case "conn_req":
        handleConnectionRequest(ws, msg.body.from);
        break;
    case "init_call_req":
        requestSDP(msg.body);
        break;
    case "offer_resp":
        initCallResponse(msg.body);
        break;  
    case "new_ice_cand_req":
        forwardIceCandidate(msg.body);
        break;
    default:
        console.log("unknown msg type: " + msg.event);
        break;
    }

}

function handleDisconnect(socket, code, reason) {
    for (const [userName, ws] of Object.entries(users)) {
        if (ws === socket) {
            delete users[userName];
            console.log("Disconnect user: ", userName, " reason: ", reason, " code: ", code);
            console.log("userlist: ", users);
            break;
        }
    }
}

function incommingConnection(socket) {
    console.log("new connection");
    socket.on('message', message => handleMessage(socket, message));
    socket.on('close', (code, reason) => handleDisconnect(socket, code, reason));
}

wss.on('connection', incommingConnection);