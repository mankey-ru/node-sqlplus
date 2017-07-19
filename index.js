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
			${sql};
			exit;
		`
	}
	if (bDebug) {
		console.log('SQL:', sqlWrap(sql))
	}
	fs.writeSync(tmpObj.fd, sqlWrap(sql));
	// console.log(fs.readFileSync(tmpObj.name).toString());
	// process.exit(0)
	var sqlplusCall = 'sqlplus -s ' + connProps;

	Spawn(sqlplusCall + ' @' + tmpObj.name, {
		onSuccess: function(result) {
			var resultStr = result.stdout;
			if (bDebug) {
				console.log('COMMAND RESULT: ' + resultStr)
			}
			var colNamesArray = resultStr.split(/\r\n?|\n/, 2)[1].split('"').join('').split(',');
			var csvparseOpt = {
				columns: colNamesArray,
				skip_lines_with_empty_values: true,
				from: 2 // first line is blank, second is headings
			};
			csvparse(resultStr, csvparseOpt, function(err, data) {
				if (err) {
					console.log('CSV parsing error: ' + err)
				}
				callback(err, data);
			})
		}
	})

	function Spawn(commandString, opt) {
		var cmd = {
			app: isWin ? process.env.comspec : process.env.SHELL || '/bin/bash', // путь к командному интерпретатору
			argName: isWin ? '/c' : '-c', // имя аргумента командного интерпретатора, в который можно передавать команду
			delim: isWin ? '&&' : ';', // разделитель инлайн команд
			diskOpt: isWin ? '/d' : '' // опция cd указывающая что аргумент команды будет в формате drive:directory
		};

		opt = opt || {};
		if (bDebug) {
			console.log('Spawn: running command «' + (opt.cwd ? opt.cwd + ' > ' : '') + commandString + '»');
		}
		var spawnOpt = {};
		if (opt.cwd) {
			spawnOpt.cwd = opt.cwd;
		}
		spawnOpt.encoding = 'utf8';
		var mySpawn = spawn(cmd.app, [cmd.argName, commandString], spawnOpt);
		// http://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options
		var bError = false;
		var result = {
			stdout: '',
			stderr: ''
		};

		mySpawn.stdout.on('data', function(data) {
			var dataStr = data.toString();
			result.stdout += dataStr;
			if (dataStr.indexOf('[ERROR]') !== -1) { // мавен не даёт по-другому определить ошибку
				bError = true;
			}
		});
		mySpawn.stderr.on('data', function(data) {
			var dataStr = data.toString();
			console.log('STDERR=' + dataStr);
			result.stderr += dataStr;
			bError = true;
		});
		mySpawn.on('exit', function(code) {
			//console.log('EXITCODE=' + code);
			var hasOpt = typeof opt !== 'undefined';
			if (hasOpt === true) {
				if (bError === false && typeof opt.onSuccess === 'function') {
					opt.onSuccess(result)
				}
				if (bError === true && typeof opt.onError === 'function') {
					opt.onError(result)
				}
				if (typeof opt.onComplete === 'function') {
					opt.onComplete(result)
				}
			}
		});
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