const { Server } = require('ws');
const authenticated = [];
module.exports = {
    ws : null,
    init : function(app, db){
        this.ws = new Server({server: app}, function(ws)
		{
			console.log("WebSocket server started on ");
		});
		this.ws.on('connection', (socket, req) => 
		{
			console.log("New WS connection");
            var hash = req.url.slice(1);
			
            if(hash.length <= 1) {
                socket.close(); // If the request doesn't contain a login hash, then disconnect
            }
            else{
                checkIfLoggedIn(db, socket, hash, function(author) {
                    authenticated.push({socket : socket, author : author});
					socket.on('close', function(code, reason) 
					{
						authenticated.splice(authenticated.indexOf({socket : socket, author : author}), 1);
						console.log("WS client disconnected peacefully");
					});
					socket.on('error', function(err) 
					{
						authenticated.splice(authenticated.indexOf({socket : socket, author : author}), 1);
						console.log("WS client disconnected with error");
					});
                });
            }
		});
		
		this.ws.on("error", function(error) 
		{
			console.log(error);
		});
    },
    messageUpdate : function(message, type) {
        authenticated.forEach(elem => {
			if(elem.readyState == elem.OPEN) 
			{
				elem.socket.send(JSON.stringify({type : type, message : message}));
			}
        });
    }
}

function checkIfLoggedIn(db, socket, hash, callback) {
    if(!hash) {
        socket.close();
        return;
    }
    db.query("SELECT * FROM authors WHERE \"hash\" = $1", [hash], function(dberr, dbres) {
        if(!dberr && dbres.rowCount == 1) {
            callback(dbres.rows[0]);
            return;
        }
        else {
            socket.close();
        }
    });
}