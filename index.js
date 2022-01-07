const spawn = require('child_process').spawn
const csvparse = require('csv-parse').parse
const isWin = process.platform === 'win32'
const isMac = process.platform === 'darwin'
const isLinux = process.platform === 'linux'

if (isMac) {
  // Useful for Electron apps as GUI apps on macOS doesn't inherit
  // the $PATH defined in your dotfiles (.bashrc/.bash_profile/.zshrc/etc).
  require('fix-path')()
}

/**
 * @sql - SQL Statement to execute
 * @conProps - username/password@databaseName using TNS names
 * @callback - callback function to pass results/error
 * @bDebug - enable debug output to console
 * @maxTimeout - maximum time the function is waiting for results from SQLPLus process
 **/
module.exports = function (sql, connProps, callback, bDebug, maxTimeout) {
  if (typeof sql !== 'string') {
    callback(new Error('Please provide first argument: {string} i.e. SELECT ID, NAME FROM USERS'))
  }
  if (typeof connProps !== 'string') {
    callback(new Error('Please specify second argument: {string} i.e. USER/PWD@TNS_NAME'))
  }

  debuglog(`process.platform: ${process.platform}`)
  const commandString = 'sqlplus -s ' + connProps

  let shellApp // default shell app
  if (isWin) {
    shellApp = process.env.comspec || 'cmd.exe'
  } else {
    shellApp = process.env.SHELL || '/bin/bash'
  }

  const shellAppCmdArg = isWin ? '/c' : '-c'

  debuglog(`shellApp: ${shellApp}`)
  debuglog(`shellAppCmdArg: ${shellAppCmdArg}`)
  debuglog(`commandString: ${commandString}`)
  debuglog(`sql: ${sqlWrap(sql)}`)
  let output = ''
  let stderr = '' // error of command itself, for example "ORA-" not included
  function onOutput (data, isError) {
    output += data.toString()
  }
  // http://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options
  const sqlPlusProcess = spawn(shellApp, [shellAppCmdArg, commandString])
  sqlPlusProcess.stdout.on('data', onOutput)
  sqlPlusProcess.stderr.on('data', function (data) {
    onOutput(data)
    stderr += data.toString()
  })
  sqlPlusProcess.on('exit', finish)
  sqlPlusProcess.on('error', finish)
  const exitTimeout = setTimeout(finish, maxTimeout || 10000)
  // pass SQL script to SQLPlus via stdin
  sqlPlusProcess.stdin.write(sqlWrap(sql))
  // sqlPlusProcess.stdin.end()
  function finish (exitCode) {
    clearTimeout(exitTimeout)
    debuglog(`stderr: ${stderr}`)

    let resultError = ''
    let bEmpty = false
    if (typeof exitCode === 'undefined') {
      resultError += 'Command timed out'
      sqlPlusProcess.kill('SIGKILL')
    }
    if (stderr) {
      resultError += `STDERR ${stderr}`
    }
    if (output.indexOf('SP2-') === 0) {
      // SP2-0158: unknown SET option "CSV"
      // - means that client version is less than 12.2
      resultError += output
    }
    if (output.indexOf('ORA-') !== -1) {
      resultError += output
    }
    if (output.indexOf('sqlplus') === 0) {
      // 'sqlplus' is not recognized as an internal or external command,
      // operable program or batch file.
      resultError += output
    }
    if (output === '') {
      bEmpty = true
    }

    debuglog('EXITCODE: ' + exitCode)
    debuglog('COMMAND OUTPUT: ' + output)

    if (output !== '' && resultError === '') {
      const colNamesArray = output.split(/\r\n?|\n/, 2)[1].split('"').join('').split(',')
      const csvparseOpt = {
        columns: colNamesArray,
        relax_column_count: true,
        skip_lines_with_empty_values: true,
        from: 2 // first line is blank, second is headings
      }
      csvparse(output, csvparseOpt, function (parseErr, data) {
        if (parseErr) {
          console.log(`sqlplus result CSV parsing error: ${parseErr} OUTPUT: «${output}»`)
        }
        callback(parseErr || resultError, data)
      })
    } else {
      callback(resultError, [], bEmpty)
    }
  }

  /**
    * Adding output properties for SQLPlus to ensure CSV parser will work
    * @sql - SQL Statement to execute
    **/
  function sqlWrap (sql) {
    let formatSettings = 'SET MARKUP CSV ON\n'
    formatSettings += 'SET FEEDBACK OFF\n'
    formatSettings += 'SET PAGESIZE 50000\n'
    formatSettings += 'SET LINESIZE 32767\n'
    return formatSettings + sql + ';\nexit\n'
  }

  function debuglog () {
    if (bDebug) {
      console.log.apply(console, arguments)
    }
  }
}
