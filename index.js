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
  plugin.name = "Log All Signal K Data"
  plugin.description = "Log Signal K data to compressed flat files."

  plugin.schema = {
    type: "object",
    title: "Data logging to flat files",
    description: "Log Signal K data as delta objects into flat files.",
    properties: {
      logdir: {
        type: 'string',
        title: 'Data log file directory',
        default: ''
      },
      interval: {
        type: 'number',
        title: 'Log rotation interval (in seconds). Value of zero disables log rotation.',
        default: 600
      }
    }
  }

  plugin.start = function (options) {
    if (options["logdir"] !== "" && fs.existsSync(options["logdir"])) {
      logDir = options["logdir"]
      logRotationInterval = options["interval"]

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
    } else {
      console.log("Log directory isn't set or doesn't exist, data logging disabled")
    }
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

  function rotateLogFile(time, compressPrevious = false) {
    // update the log filename
    var oldLogFileName = logFileName
    logFileName = "sk-delta-log.".concat(time.toISOString()).concat('.log')

    // gzip the old logfile
    if (compressPrevious) {
      var oldLogPath = path.join(logDir, oldLogFileName)
      const gzip = spawn('gzip', [oldLogPath])
      gzip.on('close', (code) => {
        if (code !== 0) {
          console.log(`Compressing file ${oldLogPath} failed with exit code ${code}`)
        }
      })
    }
  }
}
