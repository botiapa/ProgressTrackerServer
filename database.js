module.exports = function() {
    const fs = require('fs');
    const mysql = require('mysql');

    path = require('path'),    
    filePath = path.join(__dirname, 'auth.key');
	
	var SERVER;
	var DATABASE;
	var UID;
	var PASSWORD;
	var DBPORT;
	
	split = fs.readFileSync(filePath, {encoding: "utf8"}).split(";");
		SERVERa = split[0];
		DATABASEa = split[1];
		UIDa = split[2];
		PASSWORDa = split[3];
		DBPORTa = split[4];

	if(process.env.USE_ENV == null || process.env.USE_ENV == false) 
	{
		console.log("Using auth.key file for config");
		split = fs.readFileSync(filePath, {encoding: "utf8"}).split(";");
		SERVER = split[0];
		DATABASE = split[1];
		UID = split[2];
		PASSWORD = split[3];
		DBPORT = split[4];
	}
	else if(process.env.USE_ENV != null && process.env.USE_ENV == "true")
	{
		console.log("Using environment variables for config");
		SERVER = process.env.CONFIG_SERVER;
		DATABASE = process.env.CONFIG_DATABASE;
		UID = process.env.CONFIG_UID;
		PASSWORD = process.env.CONFIG_PASSWORD;
		DBPORT = process.env.CONFIG_DBPORT;
	}
	
    var connection = mysql.createConnection({
        host     : SERVER,
        user     : UID,
        password : PASSWORD,
        database : DATABASE,
        port: DBPORT
    });
	
    connection.connect(function(err) 
	{
		if(err) throw err;
		console.log("Database connected successfully!");
	});
	
    return connection;
}