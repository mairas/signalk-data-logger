const Bacon = require("baconjs");
const debug = require("debug")("signalk:signalk-data-logger");
const util = require("util");
const _ = require('lodash')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

/*

Signal K server plugin to log Signal K deltas to flat files.

Features:
- Basic logging
- Configurable log directory
- Splitting per hour

TODO:
- Exclude filtering
- Include filtering
- Throttling

*/

module.exports = function(app) {
  var plugin = {};
  var unsubscribes = [];
  var logDir = ""
  var logFileName = "data_log.json"
  var logRotationInterval = 600

  plugin.id = "sk-data-logger"
  plugin.name = "Signal K delta logger"
  plugin.description = "Log Signal K delta objects to compressed flat files."

  plugin.schema = {
    type: "object",
    title: "Data logging to flat files",
    description: "Log Signal K data as delta objects into flat files.",
    properties: {
      logdir: {
        type: 'string',
        title: 'Data log file directory',
        default: '/home/pi/sk-delta-logs'
      },
      interval: {
        type: 'number',
        title: 'Log rotation interval (in seconds). Value of zero disables log rotation.',
        default: 600
      }
    }
  }

  plugin.start = function (options) {
    if (typeof options.logdir === 'undefined') {
      app.setProviderStatus('Log directory not defined, plugin disabled')
      return
    }
    logDir = options.logdir
    logRotationInterval = options.interval

    if (!fs.existsSync(logDir)) {
      // attempt creating the log directory
      try {
        fs.mkdirSync(logDir)
      } catch (error) {
        app.setProviderStatus(`Unable to create log directory ${logDir}, plugin disabled`)
        return
      }
    }

    // compress the old leftover logfile, if any
    const logMetaFileName = path.join(logDir, '.current_log_file')
    if (fs.existsSync(logMetaFileName)) {
      app.debug("meta file exists")
      const oldLogFile = fs.readFileSync(logMetaFileName).toString()
      if (fs.existsSync(path.join(logDir, oldLogFile))) {
        compressLogFile(logDir, oldLogFile)
      }
    }

    // create a new logfile
    rotateLogFile(new Date())

    if (logRotationInterval > 0) {
      setInterval(() => {
          rotateLogFile(new Date(), true)
        },
        logRotationInterval * 1000
      )
    }

    app.signalk.on('delta', (delta) => {
      try {
        writeDelta(delta)
      } catch ( err ) {
        console.log(err)
      }
    })
  }

  plugin.stop = function () {
    // compress the log file
    rotateLogFile(new Date(), true)

    // supposedly no need to unsubscribe a delta handler?

    // plugin.unsubscribes.forEach(f => f())
    // unsubscribes = []
  }

  return plugin

  function writeDelta(delta) {
    fs.appendFile(
      path.join(logDir, logFileName),
      JSON.stringify(delta).concat("\n"), (err) => {
        if (err) throw err;
      }
    )
  }

  function compressLogFile(logDir, logFileName) {
    let logPath = path.join(logDir, logFileName)
    const gzip = spawn('gzip', [logPath])
    gzip.on('close', (code) => {
      if (code !== 0) {
        console.log(`Compressing file ${logPath} failed with exit code ${code}`)
      }
    })
  }

  function rotateLogFile(time, compressPrevious = false) {
    // update the log filename
    const oldLogFileName = logFileName
    logFileName = "sk-delta-log.".concat(time.toISOString().replace(/:/g,"-")).concat('.log')

    // gzip the old logfile
    if (compressPrevious) {
      compressLogFile(logDir, oldLogFileName)
    }

    // keep track of the current log file
    fs.writeFileSync(path.join(logDir, '.current_log_file'), logFileName)
  }
}
