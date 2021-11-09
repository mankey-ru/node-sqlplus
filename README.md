# [BETA] node-sqlplus
A simple wrapper for Oracle SQL*Plus v.12.2+

Since the original node-oracledb is quite an overkill solution for simple projects* I made this simple wrapper for simple needs like fetching data.

The only prerequisite is Oracle Instant CLient with SQL*Plus v.12.2+
That's how to install it: first, [select your platform](http://www.oracle.com/technetwork/database/features/instant-client/index-097480.html)
Then, on the next page you need to download two packages 
- Instant Client Package - Basic
- Instant Client Package - SQL*Plus

Then unpack both archives content together into one dir.
Then create subdirs /network/admin and put there your tnsnames.ors file.
Windows users might have to set 
- PATH to the folder with sqlplus executable
- ORACLE_HOME to your Oracle folder 
- TNS_ADMIN to the folder containing tnsnames.ora file 

\* - i.e. Windows users have to install MS Visual Studio in order to get oracledb work

# Usage
```
var sql = `select * from mytable`;
var connProps = 'myScheme/mySchemePassword@myTnsName';
sqlplus(sql, connProps, function(err, rows){
	if (err) {
		console.log(err)
	}
	else {
		console.log(rows)
	}
  }, 
  false, // optional parameter: debug=false (default) activates debug messages on console
  5000); // optional parameter: timeout=10000 (default) for sqlplus process in milliseconds
```
