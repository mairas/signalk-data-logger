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
- Include filtering by subscription paths
- Throttling by subscription period

TODO:
- Exclude filtering
*/

module.exports = function(app) {
  var plugin = {};
  var subscribes = [];
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
        default: 600 // should this default be hourly (3600) rather than every 10 min?
      },
      context: {
        type: 'string',
        title: 'Subscription context',
        default: 'vessels.self'
      },
      subscribes: {
        type: 'array',
        title: 'Subscribes',
        items: {
          type: 'object',
          properties:
          {
            path: {
              type: 'string',
              title: 'Path. Wildcards are supported.',
              default: '*'
            },
            period: {
              type: 'number',
              title: 'Period (in milliseconds).',
              default: 1000
            }
          }
        }
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
    context = options.context
    subscribes = options.subscribes
    unsubscribes = [];

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

    if (typeof subscribes === 'undefined' || subscribes.length == 0) {
      // if no subscribes are configured, subscribe to everything for backwards compatibility
      app.debug("no subscribes are configured - log everything")
      app.signalk.on('delta', (delta) => {
          writeDelta(delta)
      })
    }
    else {
      app.debug("subscribes are configured")
      // create the subscription based on the options
      subscription = {
        context: context,
        subscribe: subscribes
      };
      
      app.debug("subscribing to " + subscribes.length + " path(s)")
      app.subscriptionmanager.subscribe(
        subscription,
        unsubscribes,
        subscriptionError => {
          app.error('Error:' + subscriptionError);
        },
        delta => {
          delta.updates.forEach(d => {
            writeDelta(d)
          });
        }
      );
    }
  }

  plugin.stop = function () {
    // compress the log file
    rotateLogFile(new Date(), true)

    // call unsubscribes - failing to do so will produce duplicate subscriptions on plugin config submissions until restart
    app.debug("unsubscribing from all paths")
    unsubscribes.forEach(f => f());
  }
  return plugin

  function writeDelta(delta) {
    try {
      fs.appendFile(
        path.join(logDir, logFileName),
        JSON.stringify(delta).concat("\n"), (err) => {
          if (err) throw err;
        }
      )
    } catch (err) {
      console.log(err)
    }
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
