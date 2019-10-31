/* version 1.0.7 */
var log4js = require('log4js');
var ownerName;
var namePadding = 10;

class Logging {
    /**
     * This object contains the configuration information for the logging subsystem
     * @typedef {Object} loggingOptions 
     * @property {string} level 
     * @property {array} areas 
     * @property {string} owner Application name
     */
    /**
     * 
     * @param {loggingOptions} options This list contains names of any additional areas that need to be created on start
     */
    //constructor(areas = [], owner) {
    constructor(options = {}) {
        this.setOwner(options.owner || 'UNKNOWN');
        log4js.configure(this.getBasicConfig());
        this.system = log4js.getLogger(this.getOwnerFormatted() + 'SYSTEM');
        this.system.info('Starting');
        this.system.info('Main logging initialised ');
        if (options.areas) {
            options.areas.forEach(area => {
                this.createLoggingArea(area);
            });
        }
    }

    /**
     * Sets the name of the owner
     * @param {string} owner Name of the logger
     */
    setOwner(owner) {
        ownerName = owner;
    }

    /**
     * 
     * @return {string} This returns the value for owner
     */
    getOwnerFormatted() {
        return '[' + ownerName.toUpperCase().padStart(namePadding, ' ') + '] ';
    }

    /**
     * 
     * @return {object} This is the default config for log4js
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
                    "maxLogSize": 1048576,
                    "backups": 10
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
     * 
     * @param {string} name Logger name
     * @param {string} level Level of logging required
     * @return {object} This log4js object that gets used by Express
     */
    getExpressLogger(name = 'EXPRESS', level = 'auto') {
        return log4js.connectLogger(log4js.getLogger(this.getOwnerFormatted() + name), { level: level });
    }

    /**
     * 
     * @param {string} logger Name of the logger
     * @return {boolean} The result from trying to create a logging area
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

module.commandName = 'Logging';
module.exports = Logging;
module.helpText = 'Logging subsystem';