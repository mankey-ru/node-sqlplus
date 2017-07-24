const fs = require('fs');
const tmp = require('tmp');
const spawn = require('child_process').spawn;
const csvparse = require('csv-parse');

const isWin = process.platform === 'win32';
const slash = isWin ? '\\' : '/';

var tmpObj = tmp.fileSync({
	postfix: '.sql'
});

module.exports = function(sql, connProps, callback, bDebug) {
	if (typeof sql !== 'string') {
		return 'Please provide first argument: {string} i.e. SELECT ID, NAME FROM USERS';
	}
	if (typeof connProps !== 'string') {
		return 'Please specify second argument: {string} i.e. USER/PWD@TNS_NAME';
	}

	function sqlWrap(sql) {
		return `
			SET MARKUP CSV ON
			SET FEEDBACK OFF
			SET PAGESIZE 50000
			SET LINESIZE 32767
			${sql};
			exit;
		`
	}

	fs.writeSync(tmpObj.fd, sqlWrap(sql));
	Spawn('sqlplus -s ' + connProps + ' @' + tmpObj.name)

	function Spawn(commandString) {
		var cmd = {
			app: isWin ? process.env.comspec : process.env.SHELL || '/bin/bash', // путь к командному интерпретатору
			argName: isWin ? '/c' : '-c', // имя аргумента командного интерпретатора, в который можно передавать команду
			delim: isWin ? '&&' : ';', // разделитель инлайн команд
			diskOpt: isWin ? '/d' : '' // опция cd указывающая что аргумент команды будет в формате drive:directory
		};
		if (bDebug) {
			console.log('SQL:', sqlWrap(sql))
			console.log('COMMAND: «' + commandString + '»');
		}
		//spawnOpt.encoding = 'utf8';
		var mySpawn = spawn(cmd.app, [cmd.argName, commandString]);
		// http://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options	
		var output = '';

		mySpawn.stdout.on('data', onOutput);
		mySpawn.stderr.on('data', onOutput);

		function onOutput(data) {
			var dataStr = data.toString();
			output += dataStr;
		}

		mySpawn.on('exit', finish);
		var exitTimeout = setTimeout(finish, 5000);

		function finish(exitCode) {
			clearTimeout(exitTimeout);
			var resultError = '';
			if (typeof exitCode === 'undefined') {
				resultError += 'Command timed out\n';
			}
			if (output.indexOf('ORA-') !== -1) {
				resultError += output;
			}
			if (bDebug) {
				console.log('EXITCODE: ' + exitCode);
				console.log('COMMAND OUTPUT: ' + output)
			}
			if (resultError === '') {
				var colNamesArray = output.split(/\r\n?|\n/, 2)[1].split('"').join('').split(',');
				var csvparseOpt = {
					columns: colNamesArray,
					skip_lines_with_empty_values: true,
					from: 2 // first line is blank, second is headings
				};
				csvparse(output, csvparseOpt, function(parseErr, data) {
					if (parseErr) {
						console.log('CSV parsing error: ' + parseErr)
					}
					callback(parseErr || resultError, data);
				})
			}
			else {
				callback(resultError);
			}
		}
	};



	/*`
	SET WRAP OFF
	SET PAGESIZE 0
	select * from APP_PASSPORT_TYPE_DEF

	--commit;
	--exit

	--end;
	--/
	`*/
}