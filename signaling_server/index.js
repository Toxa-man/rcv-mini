const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

console.log("started");

var users = {};

function handleConnectionRequest(ws, userName) {
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
    const msg = {
        event: "offer_req",
        body: body
    }

    users[body.to].send(JSON.stringify(msg));
}

function initCallResponse(body) {
    const msg = {
        event: "init_call_resp",
        body: body
    }

    users[body.to].send(JSON.stringify(msg));
}

function handleMessage(ws, message) {
    var msg = JSON.parse(message);
    console.log("new message: ", msg);
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
    }

}

function handleDisconnect(socket, code, reason) {
    for (const [userName, ws] of Object.entries(users)) {
        if (ws === socket) {
            delete users[userName];
            console.log("Disconnect user: ", userName, " reason: ", reason);
            console.log("userlist: ", users);
            break;
        }
    }
}

function incommingConnection(socket) {
    console.log("new connection: ");
    socket.on('message', message => handleMessage(socket, message));
    socket.on('close', (code, reason) => handleDisconnect(socket, code, reason));
}

wss.on('connection', incommingConnection);