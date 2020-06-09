/* version 1.2.0 */
// Declare any/all external libs
var log4js = require('log4js');
var namePadding = 10;

class logger {
    /**
     * @typedef {Object} loggingOptions 
     * @property {string} level Level of logging required
     * @property {array} areas Areas to setup setup for logging
     * @property {string} owner Application name
     * @description This object contains the configuration information for the logging subsystem
     */
    /**
     * @constructor 
     * @param {loggingOptions} options This list contains names of any additional areas that need to be created on start
     */
    constructor(options = {}) {
        this.setOwner(options.owner || 'UNKNOWN');
        log4js.configure(this.getBasicConfig());
        this.system = log4js.getLogger(this.getOwnerFormatted() + 'SYSTEM');
        //        this.system.info('Starting');
        this.system.info('Main logging initialised ');
        if (options.areas) {
            options.areas.sort().forEach(area => {
                this.createLoggingArea(area);
            });
        }
    }

    /**
     * @param {string} owner Name of the logger
     * @description Sets the name of the owner
     */
    setOwner(owner) {
        this.ownerName = owner;
    }

    /**
     * @return {string} This returns the value for owner
     * @description This pads up and upper cases the owner
     */
    getOwnerFormatted() {
        return '[' + this.ownerName.toUpperCase().padStart(namePadding, ' ') + '] ';
    }

    /**
     * @return {object} This is the default config for log4js
     * @description This is the complete 'configuration' for the logging sub system
     */
    getBasicConfig() {
        return {
            "appenders": {
                "localConsole": {
                    "type": "console"
                },
                "localFile": {
                    "type": "file",
                    "filename": "logs/server.log",
                    "maxLogSize": 5242880,
                    "backups": 20
                }
            },
            "categories": {
                "default": {
                    "appenders": [
                        "localConsole", "localFile"
                    ],
                    "level": "debug"
                },
                "localFile": {
                    "appenders": [
                        "localFile"
                    ],
                    "level": "error"
                }
            }
        }
    }

    /**
     * @param {string} name Logger name
     * @param {string} level Level of logging required
     * @return {object} This log4js object that gets used by Express
     * @description This function returns an object that the 'express' sub system would use
     */
    getExpressLogger(name = 'EXPRESS', level = 'auto') {
        return log4js.connectLogger(log4js.getLogger(this.getOwnerFormatted() + name), { level: level });
    }

    /**
     * @param {string} logger Name of the logger
     * @return {boolean} The result from trying to create a logging area
     * @description This function creates the required logging area
     */
    createLoggingArea(logger) {
        if (this[logger.toLowerCase()]) {
            this.system.warn('"' + logger.toLowerCase() + '"' + ' logger already exists ');
            return false;
        }

        this[logger.toLowerCase()] = log4js.getLogger(this.getOwnerFormatted() + logger.toUpperCase());
        this[logger.toLowerCase()].debug('"' + logger.toUpperCase() + '"' + ' logging area initialised');
        return true;
    }
}

module.commandName = 'logger';
module.exports = logger;
module.helpText = 'Logging subsystem';