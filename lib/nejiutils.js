/* version 1.1.0 */
// Declare any and all external libs
var Netmask = require('netmask').Netmask;
var crypto = require('crypto');

function nejiutils() {
    /**
     * @const {string} Regex pattern for IPv4 netmasks
     * @description description
     */
    // eslint-disable-next-line no-useless-escape
    const VALIDIPV4NETMASKREGEX = '^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(2[4-9])$';
    /**
     * @const {string} Regex pattern for IPv4 addresses
     */
    // eslint-disable-next-line no-useless-escape
    const VALIDIPV4ADDRESSREGEX = '^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$';
    /**
     * @const {string} Regex pattern for host names
     * @description description
     */
    // eslint-disable-next-line no-useless-escape
    const VALIDHOSTNAMEREGEX = '^(?=.{1,255}$)[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?)*\.?$';

    /**
     * @const {string} Regex pattern for yyyymmdd dates
     * @description description
     */
    // eslint-disable-next-line no-useless-escape
    const RAWDATEREGEX = '/(\d{4})(\d{2})(\d{2})/';

    /**
     * @const {string} Regex pattern for hhmmss times
     * @description description
     */
    // eslint-disable-next-line no-useless-escape
    const RAWTIMEREGEX = '(?!^)(?=(?:\d{2})+(?:\.|$))';

    /**
     * @const {string} Regex pattern for hhmmss times
     * @description description
     */
    // eslint-disable-next-line no-useless-escape
    const ROUNDDOWNTIMEREGEX = '/(\d{3})([0-4]{1})(\d{2})/';

    /**
     * @const {string} Regex pattern for hhmmss times
     * @description description
     */
    // eslint-disable-next-line no-useless-escape
    const ROUNDUPTIMEREGEX = '/(\d{3})([5-9]{1})(\d{2})/';

    /**
     * @function mysqlTruncColumn
     * @property {string} stringToTrunc String to truncate
     * @description This function truncates a string to not more than 4000 characters
     */
    this.mysqlTruncColumn = function(line, length = 4000) {
        return line.toString().slice(1, length)
    };

    /**
     * @function mysqlEscape
     * @property {string} stringToEscape String to escape
     * @description This function applies escapes on the line that gets sent to MySQL
     */
    this.mysqlEscape = function(line) {
        return line.toString()
            .replace("\\", "\\\\")
            // eslint-disable-next-line no-useless-escape
            .replace("\'", "\\\'")
            .replace("\"", "\\\"")
            .replace("\n", "\\\n")
            .replace("\r", "\\\r")
            .replace("\x00", "\\\x00")
            .replace("\x1a", "\\\x1a");
    };

    /**
     * @function padValue
     * @param {string} value Returned value after any required padding
     * @param {number} padding An optional range for how much padding is needed.
     * @return {string} This is the returning data
     * @description This pads an item default of 2 '0's
     */
    this.padValue = function(value, padding = 2) {
        return value.toString().padStart(padding, '0');
    }

    /**
     * @function formatDateTime
     * @param {string} datetimeRaw The string that we need to format
     * @param {string} separator Seperator
     * @param {string} type The type of the item
     * @return {string} This is the returning value after formatting
     * @description This
     */
    this.formatDateTime = function(datetimeRaw, separator, type) {
        switch (type) {
            case 'time':
                return datetimeRaw.replace(RAWTIMEREGEX, separator);
            case 'date':
                return datetimeRaw.replace(RAWDATEREGEX, '$1' + separator + '$2' + separator + '$3');
        }
        return '';
    }

    /**
     * @function buildRTime
     * @param {string} time time value that needs to be rounded to '0' or '5'
     * @return {string} This is the returning value
     * @description This
     */
    this.buildRTime = function(time) {
        let timeReplace = time.replace(ROUNDDOWNTIMEREGEX, '$1000');
        if (timeReplace)
            return timeReplace;
        timeReplace = time.replace(ROUNDUPTIMEREGEX, '$1500');
        if (timeReplace)
            return timeReplace;
    }

    /**
     * @function defaultValue
     * @param {*} value This is the value to check if it is null
     * @return {string} This is the returning data
     * @description This
     */
    this.defaultValue = function(value, defValue = 'N/A') {
        if (value) {
            return value;
        }
        return defValue;
    }

    /**
     * @function buildHash
     * @param {*} msg This is the data to be hashed
     * @return {string} This is the returning hash based on the data given to it
     * @description This
     */
    this.buildHash = function(msg) {
        let str = '';
        for (let k in msg) {
            if (Object.prototype.hasOwnProperty.call(msg, k)) {
                if (msg[k].constructor === Object) {
                    str += JSON.stringify(msg[k]);
                } else {
                    str += msg[k];
                }
            }
        }
        let hash = crypto.createHash('sha256');
        hash.update(str);
        return hash.digest('hex');
    }

    /**
     * @typedef {object} validateTargetAddressResult
     * @property {boolean} status This indicates if teh vaildation was successful
     * @property {string} debug This field contains information of the checks. It can be used as feedback
     * @property {array} data The returning data contains a list of addresses or just the host
     * @description The returning data structure from testing the supplied host against the various validations
     */
    /**
     * @function validateTargetAddress
     * @param {string} host Host to check
     * @return {validateTargetAddressResult} The returning data structure from testing the supplied host against the various validations
     * @description This function validates the supplied variable 'host'
     */
    this.validateTargetAddress = function(host) {
        // Declare result object
        let validatedResults = {
            status: false,
            debug: "",
            data: []
        };

        // Check if target ip address contains a subnet
        if (isValidIPv4Netmask(host) && !validatedResults.status) {
            validatedResults.debug = 'Address "' + host + '" is of "IPv4Netmask" type';
            let block = new Netmask(host);
            // eslint-disable-next-line no-unused-vars
            block.forEach(function(ip, long, index) {
                validatedResults.data.push(ip);
            });
            validatedResults.status = true;
        }
        // Check if target is an ip address
        if (isValidIPv4(host) && !validatedResults.status) {
            validatedResults.debug = 'Address "' + host + '" is of "IPv4" type';
            validatedResults.data.push(host);
            validatedResults.status = true;
        }
        // Check if target is a hostname
        if (isValidHost(host) && !validatedResults.status) {
            validatedResults.debug = 'Address "' + host + '" is of "host" type';
            validatedResults.data.push(host);
            validatedResults.status = true;
        }

        return validatedResults;
    };

    /**
     * @function getNumericValue
     * @param {string} address Item to be tested
     * @return {number} This indicates if the match was successful or not
     * @description This tests the supplied address against the predefined regex of IPv4 addresses
     */
    this.getNumericValue = function(value, defValue = 0) {
        let patt = /\d/g;
        if (patt.test(value)) {
            return value.replace(/[^-0-9]\D+|%/g, '');
        }
        return defValue;
    }

    /**
     * @function isValidIPv4
     * @param {string} address Item to be tested
     * @return {boolean} This indicates if the match was successful or not
     * @description This tests the supplied address against the predefined regex of IPv4 addresses
     */
    function isValidIPv4(address) {
        let testIPv4AddressRegex = new RegExp(VALIDIPV4ADDRESSREGEX, 'g');
        if (String(address).match(testIPv4AddressRegex)) {
            return true;
        }
        return false;
    }

    /**
     * @function isValidHost
     * @param {string} host Item to be tested
     * @return {boolean} This indicates if the match was successful or not
     * @description This tests the supplied address against the predefined regex of hosts
     */
    function isValidHost(host) {
        let testHostNameRegex = new RegExp(VALIDHOSTNAMEREGEX, 'g');
        if (String(host).match(testHostNameRegex)) {
            return true;
        }
        return false;
    }

    /**
     * @function isValidIPv4Netmask
     * @param {string} address Item to be tested
     * @return {boolean} This indicates if the match was successful or not
     * @description This tests the supplied address against the predefined regex of netmask
     */
    function isValidIPv4Netmask(address) {
        let testIPv4Netmaskregex = new RegExp(VALIDIPV4NETMASKREGEX, 'g');
        if (String(address).match(testIPv4Netmaskregex)) {
            return true;
        }
        return false;
    }
}


module.commandName = 'nejiutils';
module.exports = new nejiutils();
module.helpText = 'Common expressions used';