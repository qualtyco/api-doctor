import WebSocket from 'ws';

// Adversarial: this checks readyState against CLOSED, not OPEN, so the
// "drop audio while not yet open" pattern this rule targets doesn't apply.
function send(socket: WebSocket, message: object, logger: any) {
  if (socket.readyState !== WebSocket.CLOSED) {
    socket.send(JSON.stringify(message));
  } else {
    logger.error('Socket permanently closed.');
  }
}

export default send;
