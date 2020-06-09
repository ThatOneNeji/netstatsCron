/**
 * @typedef {Object} queueBase
 * @property {string} consumeBaseName This is the base queue name to use for consume
 * @property {string} publishBaseName This is the base queue name to use for publish
 * @description This object contains the queue information for the message broker subsystem
 */
/**
 * @typedef {Object} loggingConfiguration
 * @property {string} appenders Appenders serialise log events to some form of output
 * @property {string} categories The category (or categories if you provide an array
 *     of values) that will be excluded from the appender.
 * @description This defines the way the logger works
 */
/**
 * @typedef {Object} loggingOptions
 * @property {string} level The level of logging to use
 * @property {array} areas This is the various areas used for getLogger
 * @property {string} owner Application name
 * @description This object contains the configuration information for the logging subsystem
 */
/**
 * @typedef {object} ApplicationConfiguration
 * @property {loggingConfiguration} logger This defines the way the logger works
 * @property {loggingOptions} logging This object contains the configuration information for the logging subsystem
 * @property {messageBrokerServerSettings} messagebrokers This object contains the configuration information for the message broker sub system
 * @property {queueBase} queues This object contains the queue information for the message broker subsystem
 * @description Configuration from config.json
 */
/**
 * @property {ApplicationConfiguration} appConfig
 */
var appConfig;

/* Load internal libraries */
var logging = require('./lib/logger.js');
var nejiutils = require('./lib/nejiutils.js');
var MessageBroker = require('./lib/messagebroker.js');

/* 3rd party libraries */
var CronJob = require('cron').CronJob;
var fs = require('fs');
var crypto = require('crypto');
var moment = require('moment');
/* Global vars */
var Logging;
var Common;

/**
 * This object contains all the information used during runtime
 * @typedef {object} RunTime - 
 * @property {object} loadedServices - 
 * @property {object} loadedNodes - 
 * @property {array} activeServices - 
 * @property {array} activeNodes - 
 * @property {object} activeList - 
 * @property {array} QueueAreas - 
 */
var RunTime = {
    loadedServices: {},
    loadedNodes: '',
    activeServices: [],
    activeNodes: [],
    activeList: {},
    QueueAreas: []
}


/**
 * @function bail
 * @param {*} err String/object from sender
 * @description We use this to exit out of the application if fatal
 */
function bail(err) {
    console.error(err);
    process.exit(1);
}

/**
 * @function loadConfigurationFile
 * @description Reads configuration from local file
 */
function loadConfigurationFile() {
    try {
        appConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    } catch (err) {
        bail(err);
    }
}

/**
 * @function initialiseApplication
 * @description Starts up the application
 */
function initialiseApplication() {
    loadConfigurationFile();
    Logging = new logging(appConfig.logging);
    Common = new nejiutils();
    Logging.system.info('Starting');
}

/**
 * Initialise the application
 */
initialiseApplication();

/**
 * This object contains the configuration information for the logging subsystem
 * @typedef {Object} loggingOptions - 
 * @property {string} level - 
 * @property {array} areas - 
 * @property {string} owner - Application name
 */

/**
 * @typedef {object} networkServiceWorker
 * @property {integer} startTime Starting time of when the network server worker started
 * @property {integer} endTime Ending time of when the network server worker started
 * @property {string} platform Can be of aix, android, darwin, freebsd, linux, openbsd, sunos, win32, cygwin
 * @property {string} hostname This indicates on which server the NSW was run on
 * @property {string} status Success or failed
 * @description This object contains the information from the actions of the network service worker
 */
/**
 * @typedef {object} cronDataMessage
 * @property {string} area The area or type that is is used for.
 * @property {string} protocol This can be ping, mtr, http, snmp and so on
 * @property {string} groupname This is the group name
 * @property {integer} interval How often this should be run
 * @property {object} parameters Optional/default parameters to be used.
 * @property {string} host This is the host that this should be run against
 * @property {string} subscription Name of the sunscription used
 * @property {object} content Additional information for the protocol
 * @property {integer} stime Start time in epoch milliseconds
 * @property {integer} etime End time in epoch milliseconds. If we get this msg after this time then we do not action it.
 * @property {integer} nowTime 
 * @property {string} rdate Record date to use for when the result data gets loaded.
 * @property {integer} lifespan How long this command is valid for, in seconds.
 * @property {string} caid Hash value of this object. This will be used to track where this message moves to.
 * @property {networkServiceWorker} nsw This object contains the information from the actions of the network service worker
 * @description This object contains all the information that the various sub systems use
 */

/**
 * @typedef {Object} messageBrokerServerSettings
 * @property {string} host Host name or address to use
 * @property {string} user Username to use
 * @property {string} password Pasword for above listed username
 * @property {string} port Port for host (optional)
 * @property {string} vhost The vhost to use (optional)
 * @property {string} active If this host should be used or not (optional)
 * @description This object contains the configuration information for the message broker sub system
 */
/**
 * @typedef {Object} messageBrokerOptions
 * @property {function} logger - Logger to pass on to the messagebroker so that it can log messages
 * @property {messageBrokerServerSettings} config - Configuration for the RabbitMQ server
 * @property {string} receiveQueue - This is the queue to consume from
 * @property {string} receiveQueueName - This is the name of the consume instance
 * @property {function} externalHandover - This function is called from the message broker in order to action incoming data
 */
var messageBrokerOptions = {
    logger: Logging.messagebroker,
    config: appConfig.messagebrokers,
    publishQueueName: appConfig.queues.publishBaseName,
    externalHandover: receiveHandler
};

/**
 * Start the message broker sub system
 */
MessageBroker.init(messageBrokerOptions);

/**
 * Load the service data from file
 */
function servicesLoad() {
    try {
        Logging.fs.info('Loading services');
        RunTime.loadedServices = JSON.parse(require('fs').readFileSync('./services.json', 'utf8'));
        Logging.fs.info('Services loaded, "' + RunTime.loadedServices.services.length + '"');
    } catch (err) {
        Logging.fs.error(err);
    }
}

/**
 * validateTargetAddress - 
 * @param {*} hosts - This is the item that needs to be validated
 * @return {array} List of validated hosts
 */
function validateTargetAddress(hosts) {
    let addressList = [];
    hosts.forEach(host => {
        Common.validateTargetAddress(host);
        let results = Common.validateTargetAddress(host);
        if (results.status) {
            Logging.system.info(results.debug);
            results.data.forEach(address => {
                addressList.push(address);
            });
        } else {
            Logging.system.debug(results.debug);
        }
    });
    return addressList;
}

/**
 * Loop through the services and flatten that so that they are easier to use.
 */
function servicesFlatten() {
    //activeServices = [];
    Logging.system.info('Flatting services');
    RunTime.loadedServices.services.forEach(function(serviceRaw) {
        if (serviceRaw.active) {
            RunTime.QueueAreas.push(serviceRaw.protocol);
            serviceRaw.inventory.forEach(function(service) {
                if (service.active) {
                    Logging.system.info('Protocol "' + serviceRaw.protocol + '" has enabled inventory item "' + service.name + '"');
                    if (service.contents.constructor === Object) {
                        let msg = {
                            protocol: serviceRaw.protocol,
                            subscription: service.name,
                            parameters: serviceRaw.parameters,
                            area: serviceRaw.area,
                            content: service.contents,
                        };
                        RunTime.activeServices.push(msg);
                    } else {
                        service.contents.forEach(function(item) {
                            let msg = {
                                protocol: serviceRaw.protocol,
                                subscription: service.name,
                                parameters: serviceRaw.parameters,
                                area: serviceRaw.area,
                                content: item,
                            };
                            RunTime.activeServices.push(msg);
                        });
                    }
                } else {
                    Logging.system.debug('Protocol "' + serviceRaw.protocol + '" has disabled inventory item "' + service.name + '"');
                }
            })
        } else {
            Logging.system.debug('Protocol "' + serviceRaw.protocol + '" is disabled');
        }
    });
}

/**
 * Load the node data from file
 */
function nodesLoad() {
    Logging.fs.info('Loading nodes');
    try {
        RunTime.loadedNodes = JSON.parse(require('fs').readFileSync('./nodes.json', 'utf8'));
        Logging.fs.info('Nodes loaded, "' + RunTime.loadedNodes.nodes.length + '"');
    } catch (err) {
        Logging.fs.error(err);
    }
}

/**
 * Loop through the nodes and flatten that so that they are easier to use.
 */
function nodesFlatten() {
    Logging.system.info('Flatting nodes');
    RunTime.loadedNodes.nodes.forEach(function(nodeRaw) {
        if (nodeRaw.active) {
            Logging.system.debug('Group "' + nodeRaw.name + '" is enabled');
            let AddressList = validateTargetAddress(nodeRaw.addresses);
            AddressList.forEach(function(TargetAddress) {
                Object.keys(nodeRaw.protocols).forEach(function(protocol) {

                    if (nodeRaw.protocols[protocol].active) {
                        nodeRaw.protocols[protocol].subscriptions.forEach(function(subscription) {
                            let msg = {
                                protocol: protocol,
                                subscription: subscription.name,
                                groupname: nodeRaw.name,
                                host: TargetAddress,
                                trigger: subscription.trigger.type,
                                cron: subscription.trigger.value
                            };
                            if (nodeRaw.protocols[protocol].parameters) {
                                msg.parameters = nodeRaw.protocols[protocol].parameters;
                            }
                            RunTime.activeNodes.push(msg);
                        });
                    } else {
                        Logging.system.debug('Protocol "' + protocol + '" for group "' + nodeRaw.name + '" is disabled');
                    }
                });
            });
        } else {
            Logging.system.debug('Group "' + nodeRaw.name + '" is disabled');
        }
    });
    Logging.system.debug('Found "' + RunTime.activeNodes.length + '" active nodes');
}

/**
 * 
 * @typedef {object} serviceConfigData
 * @property {string} protocol - Name of the protocol
 * @property {string} subscription - Name of service
 * @property {object} parameters - Additional or default parameters
 * @property {string} area - The area or type that is is used for.
 * @property {object} content - Content
 */

/**
 * 
 * @typedef {object} NodeConfigData
 * @property {string} protocol - Name of the protocol
 * @property {string} subscription - Name of service
 * @property {string} groupname - The group to which the host belongs to
 * @property {string} host - Host to check
 * @property {object} parameters - Additional or default parameters
 * @property {string} trigger - How does thisget triggered
 * @property {string} cron - How often of when
 */

/**
 * 
 * @typedef {object} nodeServiceConfigData
 * @property {string} protocol - This can be ping, mtr, http, snmp and so on
 * @property {string} area - The area or type that is is used for.
 * @property {string} subscription - This is the subscription name
 * @property {object} content - Content.
 * @property {string} interval - How often this should be run
 * @property {string} host - Host to check
 * @property {string} groupname - The group to which the host belongs to
 * @property {object} parameters - Optional/default parameters to be used.
 */

/**
 * compileServiceHost - 
 * @param {serviceConfigData} Service - Properties
 * @param {NodeConfigData} Node - Properties
 * @return {nodeServiceConfigData} Object containing the config
 */
function compileServiceHost(Service, Node) {
    let builtStr = {
        protocol: Service.protocol,
        subscription: Service.subscription,
        area: Service.area,
        content: Service.content,
        interval: Node.cron,
        host: Node.host,
        groupname: Node.groupname,
        parameters: Node.parameters || Service.parameters || ''
    };
    return builtStr;
}

/**
 * buildNodeServiceRuntimeList - 
 */
function buildNodeServiceRuntimeList() {
    let counter = {};
    Logging.system.info('Building node service list');
    RunTime.activeNodes.forEach(function(activeNode) {
        if (typeof RunTime.activeList[activeNode.trigger] === 'undefined') {
            RunTime.activeList[activeNode.trigger] = {};
            counter[activeNode.trigger] = {};
        }
        if (typeof RunTime.activeList[activeNode.trigger][activeNode.cron] === 'undefined') {
            RunTime.activeList[activeNode.trigger][activeNode.cron] = [];
            counter[activeNode.trigger][activeNode.cron] = '';
        }
        RunTime.activeServices.forEach(function(activeService) {
            if ((activeNode.protocol === activeService.protocol) && (activeNode.subscription === activeService.subscription)) {
                RunTime.activeList[activeNode.trigger][activeNode.cron].push(compileServiceHost(activeService, activeNode));
                counter[activeNode.trigger][activeNode.cron]++;
            }
        });

    });
    Object.keys(counter).forEach(function(key) {
        Object.keys(counter[key]).forEach(function(val) {
            Logging.system.debug('Node service breakdown: type "' + key + '", occurrence "' + val + '", items "' + counter[key][val] + '"');
        });
    });

    Logging.system.info('Finished building node service runtime list');
}

/**
 * buildHash - This function allows us to create a hash value based on the supplied data
 * @param {cronDataMessage} msg - 
 * @return {string} Hash value of the supplied object
 */
function buildHash(msg) {
    let str = '';
    for (let k in msg) {
        if (msg.hasOwnProperty(k)) {
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
 * 
 * @typedef {object} runServiceOptions
 * @property {string} type - This can be ping, mtr, http, snmp and so on
 * @property {string} cron - The area or type that is is used for.
 */
/**
 * runService - This function uses the built config to determine which commands need to be sent out
 * @param {runServiceOptions} options - The interval that needs to be used.
 */
function runService(options = {}) {

    Logging.system.info('"' + options.type + '" -> "' + options.cron + '": Retrieving all service/host entries');
    let payloads = [];
    if (RunTime.activeList[options.type][options.cron]) {
        RunTime.activeList[options.type][options.cron].forEach(function(cronMsg) {
            let payload = {
                queuename: appConfig.queues.publishBaseName + '/' + cronMsg.area
            };
            cronMsg.stime = moment().valueOf();
            cronMsg.etime = moment(moment().add(Math.round((options.cron * 60) / 2), 'seconds')).valueOf();
            cronMsg.rdate = moment().format("YYYY/MM/DD HH:mm:ss");
            cronMsg.lifespan = ((options.cron * 60) / 2);
            cronMsg.service = 'cron';
            cronMsg.caid = buildHash(cronMsg);
            payload.data = cronMsg;
            payloads.push(payload);
        });
    }
    if (payloads.length) {
        Logging.messagebroker.info('"' + options.type + '" -> "' + options.cron + '": Sending ' + payloads.length + ' item(s) to the message broker');
        MessageBroker.batchPublish(payloads);
    } else {
        Logging.system.info('"' + options.type + '" -> "' + options.cron + '": Nothing to send to the message broker.');
    }
}

function createQueues() {
    Logging.messagebroker.info('Creating queues in the message broker');
    RunTime.QueueAreas.forEach(function(queuearea) {
        Logging.messagebroker.debug('Creating "' + queuearea + '" queue');
        MessageBroker.createPublishQueue(appConfig.queues.publishBaseName + '/' + queuearea);
        // MessageBroker.createConsumerQueue(appConfig.queues.publishBaseName + '/' + queuearea, queuearea)
    });
}


function receiveHandler(msg) {
    Logging.system.error(msg);
}

servicesLoad();
servicesFlatten();
nodesLoad();
nodesFlatten();
buildNodeServiceRuntimeList();
if (RunTime.QueueAreas.length) {
    createQueues();
}

/**
 * This is a cron for every 15 seconds
 */
const cronDDHHMM15 = new CronJob('*/15 * * * * *', function() {
    Logging.cron.info('Running 15 second cron');
    let options = {
        type: 'interval',
        cron: '0.25'
    }
    runService(options);
}, null, true, 'Africa/Johannesburg');

/**
 * This is a cron for every 30 seconds
 */
 const cronDDHHMM30 = new CronJob('*/30 * * * * *', function() {
    Logging.cron.info('Running 30 second cron');
    let options = {
        type: 'interval',
        cron: 0.50
    }
    runService(options);
}, null, true, 'Africa/Johannesburg'); 

/**
 * This is a cron for every 1 minute
 */
const cronDDHH01SS = new CronJob('0 * * * * *', function() {
    Logging.cron.info('Running 1 minute cron');
    let options = {
        type: 'interval',
        cron: 1
    }
    runService(options);
}, null, true, 'Africa/Johannesburg');

/**
 * This is a cron for every 5 minutes
 */
const cronDDHH05SS = new CronJob('0 */5 * * * *', function() {
    Logging.cron.info('Running 5 minutes cron');
    let options = {
        type: 'interval',
        cron: 5
    }
    runService(options);
}, null, true, 'Africa/Johannesburg');

/**
 * This is a cron for every 10 minutes
 */
/* const cronDDHH10SS = new CronJob('0 * /10 * * * *', function() {
    Logging.cron.info('Running 10 minutes cron');
    let options = {
        type: 'interval',
        cron: 10
    }
    runService(options);
}, null, true, 'Africa/Johannesburg'); */

/**
 * This is a cron for every 15 minutes
 */
/* const cronDDHH15SS = new CronJob('0 * /15 * * * *', function() {
    Logging.cron.info('Running 15 minutes cron');
    let options = {
        type: 'interval',
        cron: 15
    }
    runService(options);
}, null, true, 'Africa/Johannesburg'); */

/**
 * This is a cron for every 30 minutes
 */
/* const cronDDHH30SS = new CronJob('0 * /30 * * * *', function() {
    Logging.cron.info('Running 30 minutes cron');
    let options = {
        type: 'interval',
        cron: 30
    }
    runService(options);
}, null, true, 'Africa/Johannesburg'); */

/**
 * This is a cron for every 60 minutes
 */
/* const cronDD01MMSS = new CronJob('0 0 0 * * *', function() {
    Logging.cron.info('Running 60 minutes cron');
    let options = {
        type: 'interval',
        cron: 60
    }
    runService(options);
}, null, true, 'Africa/Johannesburg'); */

/**
 * This is a cron for every 1440 minutes
 */
/* const cron01HHMMSS = new CronJob('0 0 0 0 * *', function() {
    Logging.cron.info('Running 60 minutes cron');
    let options = {
        type: 'interval',
        cron: 1440
    }
    runService(options);
}, null, true, 'Africa/Johannesburg'); */

cronDDHHMM15.start();
cronDDHHMM30.start();
cronDDHH01SS.start();
cronDDHH05SS.start();
/*cronDDHH10SS.start();
cronDDHH15SS.start();
cronDDHH30SS.start();
cronDD01MMSS.start();
cron01HHMMSS.start(); */