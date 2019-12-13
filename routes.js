const crypto = require('crypto');
const multer  = require('multer')
const upload = multer({ dest: 'uploads/', fileFilter: FileFilter})
const fs = require('fs');


module.exports = async function(app, ws, db) {
    app.get("/", (req, res) => 
	{
		res.send("Server status: <h2 style=\"color:green;\">ONLINE</h2>")
	});
	
	app.get("/message", (req, res) => {
        db.query('SELECT * from messages', function (dberr, dbres) {
            if(!dberr) 
			{
				gatherAllMessagesWithAuthor(db, dbres, [], function(error, results) 
				{
					if(error == null) 
					{
						res.json(results);
					}
					else
						res.sendStatus(500);
				})
				
			}
			else {
				console.log(error);
				res.sendStatus(500);
			}
        });
    });
    app.post("/message/create", function(req, res) {
        checkIfLoggedIn(req, res, function(author) {
            var contents = req.body.Contents || "";
            var progress = req.body.Progress || 0;
            var ID = crypto.randomBytes(18).toString('base64');
            db.query("INSERT INTO messages(\"ID\", \"Title\", \"Contents\", \"Progress\", \"Author\") VALUES($1,$2,$3,$4,$5) RETURNING *", [ID, req.body.Title, contents, progress, author.ID], function(dberr, dbres) {
                if(!dberr) {
                    res.sendStatus(200);
					// Update the new message on all connected clients
					db.query("SELECT \"ID\",\"Name\",\"ImageUrl\" FROM authors WHERE \"ID\" = $1", [dbres.rows[0].Author], function(dberr_auth, dbres_auth) 
					{
						if(!dberr_auth) 
						{
							let authorObject = {ID : dbres_auth.rows[0].ID, Name : dbres_auth.rows[0].Name, ImageUrl : dbres_auth.rows[0].ImageUrl};
							ws.messageUpdate({ID : ID, Title : dbres.rows[0].Title, Contents : dbres.rows[0].Contents, Progress : dbres.rows[0].Progress, Author : authorObject, LastModified : dbres.rows[0].Last_Modified}, "CREATE");
						}
						else {
							console.log(error); // If there's an error here, then there's something very wrong happening..
							res.sendStatus();
						}
					})
                }
                else {
                    console.log(error);
                    res.sendStatus(500);
                }
            });
        });
    });	
    app.post("/message/update", function(req, res) {
        checkIfLoggedIn(req, res, function(author) {
            if(!req.body.ID) {
                req.sendStatus(400);
                return;
            }
            db.query("SELECT * FROM messages WHERE \"ID\" = $1", [req.body.ID], function(dberr, dbres) {
                if(!dberr && dbres.rowCount == 1 && author.ID == dbres.rows[0].Author) {
                    let title = req.body.Title || dbres.rows[0].Title;
                    let contents = req.body.Contents || dbres.rows[0].Contents;
                    let progress = req.body.Progress || dbres.rows[0].Progress;
                    db.query("UPDATE messages SET \"Title\" = $1, \"Contents\" = $2, \"Progress\" = $3 WHERE \"ID\" = $4 RETURNING *", [title, contents, progress, req.body.ID], function(dberr, dbres_updated_msg) { // Update the new message on all connected clients
						if(dberr == null) {
							res.sendStatus(200);
							let authorObject = {ID : author.ID, Name : author.Name, ImageUrl : author.ImageUrl};
							ws.messageUpdate({ // Send websocket update about the modified message
								ID : dbres_updated_msg.rows[0].ID,
								Title : dbres_updated_msg.rows[0].Title,
								Contents : dbres_updated_msg.rows[0].Contents,
								Progress : dbres_updated_msg.rows[0].Progress,
								Author : authorObject,
								LastModified : dbres_updated_msg.rows[0].Last_Modified},
								"UPDATE");
						}
						else {
							console.log(error);
							res.sendStatus(500);
							return;
						}
                    })
					
                    
                }
				else if(error == null && author.ID != results[0].ID) 
				{
					res.sendStatus(403);
				}
                else if(error == null) {
                    res.sendStatus(404);
                }
                else {
                    console.log(error);
                    res.sendStatus(500);
                }
            })
        });
    });
    app.post("/message/delete", function(req, res) {
        checkIfLoggedIn(req, res, function(author) {
            if(!req.body.ID) {
                req.sendStatus(400);
                return;
            }
            db.query("SELECT * FROM messages WHERE \"ID\" = $1", [req.body.ID], function(dberr, dbres) {
                if(!dberr && dbres.rowCount == 1) {
                    if(author.ID == dbres.rows[0].Author) {
                        db.query("DELETE FROM messages WHERE \"ID\" = $1", [req.body.ID])
                        ws.messageUpdate({ID : req.body.ID}, "DELETE");
                        res.sendStatus(200);
                    }
                    else {
                        res.sendStatus(403);
                    }
                }
                else if(error == null) {
                    res.sendStatus(404);
                }
                else {
                    console.log(error);
                    res.sendStatus(500);
                }
            })
        });
    });
    app.post("/account/login", async function(req, res) {
        if(!req.body.username || !req.body.password)
        {
            res.sendStatus(400);
            return;
        }
        var loginHash = getRandomHash();
        db.query("SELECT * FROM authors WHERE \"Name\" = $1", [req.body.username], async function(dberr, dbres) {
            if(!dberr) 
			{
				if(dbres.rowCount == 1) {
					var hashedPassword = hashPasswordWithSalt(req.body.password, dbres.rows[0].Salt);
					await db.query("SELECT * FROM authors WHERE \"Password\" = $1 AND \"ID\" = $2", [hashedPassword[1], dbres.rows[0].ID], async function(err, dbres) {
						if(dbres.rowCount == 1) { // GOOD PASSWORD
							await db.query("UPDATE authors SET hash = $1 WHERE \"Password\" = $2 AND \"ID\" = $3", [loginHash, hashedPassword[1], dbres.rows[0].ID]);
							res.send(loginHash);
						}
						else { // BAD PASSWORD
							res.sendStatus(401);
						}
					});
				}
				else if(dbres.rowCount > 1) { // THERE IS MORE THAN ONE USER WITH THE SAME NAME
					res.sendStatus(500);
				}
				else { // NAME NOT FOUND
					res.sendStatus(401);
				}
			}
			else 
			{
				console.log(error);
				res.sendStatus(500);
			}
        });
    });
    app.post("/account/register", function(req, res) {
        if(!req.body.username || !req.body.password)
        {
            res.sendStatus(400);
            return;
        }
        var username = req.body.username;
        var hashedPair = hashPassword(req.body.password);
		
		var hashedPassword = hashedPair[1].replace("0x00", "");
		var usedSalt = hashedPair[0];
        var imageUrl = req.body.imageurl || "";

		console.log("afafaf");
        db.query("SELECT * FROM authors WHERE \"Name\"=$1", [username], function(dberr, dbres) {
            if (dberr) throw dberr;
			
            if(dbres.rowCount == 0) {
                var ID = randomValueBase64(18);
                db.query("INSERT INTO authors(\"ID\", \"Name\", \"Password\", \"Salt\", \"ImageUrl\") VALUES($1,$2,$3,$4,$5);", [ID, username, hashedPassword, usedSalt, imageUrl], function(dberr, dbres) {
                    if (dberr) throw dberr;
                    res.sendStatus(200);
                    return;
                });
            }
            else {
                res.sendStatus(400);
                return;
            }
        });
    });

    app.post("/account/info", function(req, res) {
        checkIfLoggedIn(req, res, function(author) {
            res.send(JSON.stringify({ID : author.ID, Name : author.Name, ImageUrl : author.ImageUrl}))
        });
    });

    app.post("/uploads/uploadimage", upload.single('image'), function(req, res) {
        checkIfLoggedIn(req, res, function(author) {
            fs.rename(req.file.path, "uploads/avatar_" + author.ID, function(error) {
                if(!error)
                    res.sendStatus(200);
                else {
                    console.log(error);
                    res.sendStatus(500);
                }
            });
        });
    });

    function checkIfLoggedIn(req, res, callback) {
        if(!req.body.hash) {
            res.sendStatus(401);
            return;
        }
        db.query("SELECT * FROM authors WHERE \"hash\" = $1", [req.body.hash], function(dberr, dbres) {
            if(dberr || dbres === undefined) 
			{
				res.sendStatus(401);
				return;
			} 
			if(dbres.rowCount == 1) {
                callback(dbres.rows[0]);
                return;
            }
            else if(dbres.rowCount > 1) {
                res.sendStatus(500);
            }
            else {
                res.sendStatus(401);
            }
        });
    }
};

function hashPassword(password) {
    var salt = crypto.randomBytes(255).toString('base64');
    var iterations = 100000;
    var hash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString('base64');
    return [salt, hash]
}

function hashPasswordWithSalt(password, salt) {
    var iterations = 100000;
    var hash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString('base64');
    return [salt, hash]
}

function getRandomHash() {
    var current_date = (new Date()).valueOf().toString();
    var random = Math.random().toString();
    return crypto.createHash('sha256').update(current_date + random).digest("base64");
}

function FileFilter(req, file, cb) {

    if(file.mimetype.includes("jpg") || file.mimetype.includes("png")) {
        cb(null, true)
    }
    else {
        cb(null, false)
    }
}

function randomValueBase64(byteSize) {
    return crypto
      .randomBytes(byteSize)
      .toString('base64') // convert to base64 format
      .replace(/\+/g, '0') // replace '+' with '0'
      .replace(/\//g, '0') // replace '/' with '0'
}

function gatherAllMessagesWithAuthor(db, messages, sofar, cb) 
{
	var msg = messages.rows.shift();
	
	if(!msg)
		cb(null, sofar);
	else 
	{
		db.query('SELECT \"ID\",\"Name\",\"ImageUrl\" FROM authors WHERE \"ID\" = $1', [msg.Author], function(dberr, dbres) 
		{
			if(!dberr) 
			{
				let authorObject = {ID : dbres.rows[0].ID, Name : dbres.rows[0].Name, ImageUrl : dbres.rows[0].ImageUrl};
				sofar.push({
						"ID": msg.ID,
						"Title": msg.Title,
						"Contents": msg.Contents,
						"Progress": msg.Progress,
						"Author": authorObject});
				gatherAllMessagesWithAuthor(db, messages, sofar, cb);
			}
			else
				cb(error);
		})
	}
}