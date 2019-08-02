const fs = require('fs');
const tmp = require('tmp');
const spawn = require('child_process').spawn;
const csvparse = require('csv-parse');

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

if (isMac) {
	require('fix-path')(); // Useful for Electron apps as GUI apps on macOS doesn't inherit the $PATH defined in your dotfiles (.bashrc/.bash_profile/.zshrc/etc).
}

module.exports = function(sql, connProps, callback, bDebug) {
	if (typeof sql !== 'string') {
		callback('Please provide first argument: {string} i.e. SELECT ID, NAME FROM USERS');
	}
	if (typeof connProps !== 'string') {
		callback('Please specify second argument: {string} i.e. USER/PWD@TNS_NAME');
	}

	var tmpObj = tmp.fileSync({
		postfix: '.sql'
	});

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

	var commandString = 'sqlplus -s ' + connProps + ' @' + tmpObj.name;
	var app;
	var hasStdErr = false;
	
	if (isWin) {
		app = process.env.comspec || 'cmd.exe';
	}
	else {
		app = process.env.SHELL || '/bin/bash';
	}

	var cmd = {
		app, // путь к командному интерпретатору
		argName: isWin ? '/c' : '-c', // default shell app
		delim: isWin ? '&&' : ';', // multiple inline commands delimiter
		diskOpt: isWin ? '/d' : '' // cd option for explicitly change current drive
	};
	if (bDebug) {
		console.log('SQL:', sqlWrap(sql))
		console.log('COMMAND: «' + commandString + '»');
	}
	var mySpawn = spawn(cmd.app, [cmd.argName, commandString]); // http://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options	
	var output = '';

	mySpawn.stdout.on('data', onOutput);
	mySpawn.stderr.on('data', function() {
		onOutput(data, true)
	});

	function onOutput(data, isError) {
		var dataStr = data.toString();
		output += dataStr;
	}

	mySpawn.on('exit', finish);
	var exitTimeout = setTimeout(finish, 5000);

	function finish(exitCode) {
		clearTimeout(exitTimeout);
		var resultError = '';
		var bEmpty = false;
		if (typeof exitCode === 'undefined') {
			resultError += 'Command timed out\n';
		}
		if (output.indexOf('SP2-') === 0) { // SP2-0158: unknown SET option "CSV" - нужен клиент 12.2 минимум
			resultError += output;
		}
		if (output.indexOf('ORA-') !== -1) {
			resultError += output;
		}
		if (output.indexOf(`'sqlplus'`) === 0) { // 'sqlplus' is not recognized as an internal or external command, operable program or batch file.
			resultError += output;
		}
		if (output === '') {
			bEmpty = true;
		}
		if (bDebug) {
			console.log('EXITCODE: ' + exitCode);
			console.log('COMMAND OUTPUT: ' + output)
		}
		if (output !== '' && resultError === '') {
			var colNamesArray = output.split(/\r\n?|\n/, 2)[1].split('"').join('').split(',');
			var csvparseOpt = {
				columns: colNamesArray,
				skip_lines_with_empty_values: true,
				from: 2 // first line is blank, second is headings
			};
			csvparse(output, csvparseOpt, function(parseErr, data) {
				if (parseErr) {
					console.log('CSV parsing error: ' + parseErr)
					console.log(output)
				}
				callback(parseErr || resultError, data);
			})
		}
		else {
			callback(resultError, [], bEmpty);
		}
	}
}