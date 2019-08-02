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
	// bDebug = true;

	if (typeof sql !== 'string') {
		callback('Please provide first argument: {string} i.e. SELECT ID, NAME FROM USERS');
	}
	if (typeof connProps !== 'string') {
		callback('Please specify second argument: {string} i.e. USER/PWD@TNS_NAME');
	}

	debuglog(`process.platform: ${process.platform}`);
	debuglog('Starting creation of tmp object...');

	var tmpObj = tmp.fileSync({
		postfix: '.sql'
	});

	debuglog('creation success', tmpObj);
	debuglog(`Starting write to temp file «${tmpObj.fd}»...`);

	fs.writeSync(tmpObj.fd, sqlWrap(sql));

	debuglog('write success');

	var commandString = 'sqlplus1 -s ' + connProps + ' @' + tmpObj.name;

	var shellApp; // default shell app
	if (isWin) {
		shellApp = process.env.comspec || 'cmd.exe';
	}
	else {
		shellApp = process.env.SHELL || '/bin/bash';
	}

	var shellAppCmdArg = isWin ? '/c' : '-c';

	debuglog(`shellApp: «${shellApp}»`);
	debuglog(`shellAppCmdArg: «${shellAppCmdArg}»`);
	debuglog(`commandString: «${commandString}»`);
	debuglog('sql:', sqlWrap(sql));

	var mySpawn = spawn(shellApp, [shellAppCmdArg, commandString]); // http://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options	


	var output = '';
	var stderr = ''; // error of command itself, for example "ORA-" not included
	mySpawn.stdout.on('data', onOutput);
	mySpawn.stderr.on('data', function(data) {
		onOutput(data);
		stderr += data;
	});

	function onOutput(data, isError) {
		var dataStr = data.toString();
		output += dataStr;
	}

	mySpawn.on('exit', finish);
	var exitTimeout = setTimeout(finish, 5000); // wtf

	function finish(exitCode) {
		clearTimeout(exitTimeout);

		debuglog(`stderr: «${stderr}»`);

		var resultError = '';
		var bEmpty = false;
		if (typeof exitCode === 'undefined') {
			resultError += 'Command timed out\n';
		}
		if (stderr) {
			resultError += `STDERR ${stderr}\n`;
		}
		if (output.indexOf('SP2-') === 0) { // SP2-0158: unknown SET option "CSV" - means that client version is less than 12.2
			resultError += `${output}\n`;
		}
		if (output.indexOf('ORA-') !== -1) {
			resultError += `${output}\n`;
		}
		if (output.indexOf(`'sqlplus'`) === 0) { // 'sqlplus' is not recognized as an internal or external command, operable program or batch file.
			resultError += `${output}\n`;
		}
		if (output === '') {
			bEmpty = true;
		}

		debuglog('EXITCODE: «' + exitCode + '»');
		debuglog('COMMAND OUTPUT: «' + output + '»');

		if (output !== '' && resultError === '') {
			var colNamesArray = output.split(/\r\n?|\n/, 2)[1].split('"').join('').split(',');
			var csvparseOpt = {
				columns: colNamesArray,
				skip_lines_with_empty_values: true,
				from: 2 // first line is blank, second is headings
			};
			csvparse(output, csvparseOpt, function(parseErr, data) {
				if (parseErr) {
					console.log(`SqlPlus result CSV parsing error: ${parseErr}\n OUTPUT: «${output}»`);
				}
				callback(parseErr || resultError, data);
			})
		}
		else {
			callback(resultError, [], bEmpty);
		}
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

	function debuglog() {
		if (bDebug) {
			console.log.apply(console, arguments);
		}
	}
}