var appConfig = require('./settings.json');
var appServices, appNodes, broker, activeServices, activeNodes, runtimeList = {};

var log4js = require('log4js'), moment = require('moment'), cron = require('node-cron');
var appQueue = require('./faQueue.js');
const crypto = require('crypto');

var genLogger = log4js.getLogger('general'), queueLogger = log4js.getLogger('queue'), messageLogger = log4js.getLogger('messages');
log4js.configure(appConfig.logger);
genLogger.info('Starting...');

let queueSettings = {
    url: 'amqp://' + appConfig.amqp.user + ':' + appConfig.amqp.password + '@' + appConfig.amqp.server,
    consumeQueueName: appConfig.amqp.consumeQueueName,
    isWorkerEnabled: false
};
appQueue.init(log4js, queueSettings, false);

function loadServices() {
    try {
        appServices = JSON.parse(require('fs').readFileSync('./services.json', 'utf8'));
        genLogger.info('Services loaded');
    } catch (err) {
        genLogger.error(err);
    }
}

function flattenServices() {
    activeServices = [];
    genLogger.info('Flatting services');
    appServices.config.forEach(function (serviceRaw) {
        if (serviceRaw.active) {
            for (let st = 0; st < serviceRaw.services.length; st++) {
                if (serviceRaw.services[st].active) {
                    for (let inv = 0; inv < serviceRaw.services[st].inventory.length; inv++) {
                        if (serviceRaw.services[st].inventory[inv].active) {
                            genLogger.debug('Protocol "' + serviceRaw.protocol + '" has inventory item "' + serviceRaw.services[st].inventory[inv].name + '" enabled for "' + (serviceRaw.services[st].interval * 60) + '" seconds interval');
                            if (serviceRaw.services[st].inventory[inv].hasOwnProperty("electives")) {
                                for (let elec = 0; elec < serviceRaw.services[st].inventory[inv].electives.length; elec++) {

                                    if (serviceRaw.services[st].inventory[inv].electives[elec].active) {
                                        let msg = {
                                            protocol: serviceRaw.protocol,
                                            parameters: serviceRaw.parameters,
                                            area: serviceRaw.area,
                                            group: serviceRaw.services[st].group,
                                            interval: serviceRaw.services[st].interval,
                                            name: serviceRaw.services[st].inventory[inv].name,
                                            elective: serviceRaw.services[st].inventory[inv].electives[elec].name
                                        };
                                        activeServices.push(msg);
                                    } else {
                                        genLogger.debug('Elective "' + serviceRaw.services[st].inventory[inv].electives[elec].name + '" is disabled for "' + serviceRaw.services[st].inventory[inv].name + '"');
                                    }
                                }
                            } else {
                                let msg = {
                                    protocol: serviceRaw.protocol,
                                    parameters: serviceRaw.parameters,
                                    area: serviceRaw.area,
                                    group: serviceRaw.services[st].group,
                                    interval: serviceRaw.services[st].interval,
                                    name: serviceRaw.services[st].inventory[inv].name
                                };
                                activeServices.push(msg);
                            }

                        } else {
                            genLogger.debug('Inventory entry "' + serviceRaw.services[st].inventory[inv].name + '" is not enabled for "' + serviceRaw.services[st].group + '"');
                        }
                    }
                } else {
                    genLogger.error('Service group "' + serviceRaw.services[st].group + '" is not enabled for "' + serviceRaw.protocol + '"');
                }
            }
        } else {
            genLogger.debug(serviceRaw.protocol + ' is disabled, skipping');
        }
    });
}

function loadNodes() {
    try {
        appNodes = JSON.parse(require('fs').readFileSync('./nodes.json', 'utf8'));
        genLogger.info('Nodes loaded');
    } catch (err) {
        genLogger.error(err);
    }
}

function flattenNodes() {
    genLogger.info('Flatting services');
    activeNodes = [];
    appNodes.nodes.forEach(function (nodeRaw) {
        if (nodeRaw.active) {
            genLogger.debug('Node "' + nodeRaw.name + '" is enabled');
            for (let nsl = 0; nsl < nodeRaw.subscriptions.length; nsl++) {
                if (nodeRaw.subscriptions[nsl].active) {
                    let msg = {
                        targetname: nodeRaw.name,
                        targetaddress: nodeRaw.ip_address,
                        subscription: nodeRaw.subscriptions[nsl].name,
                        protocols: nodeRaw.protocols
                    };
                    activeNodes.push(msg);
                } else {
                    genLogger.debug('Service topic ' + nodeRaw.subscriptions[nsl].name + ' is not enabled for ' + nodeRaw.name);
                }
            }
        } else {
            genLogger.debug(nodeRaw.name + ' is disabled');
        }
    });
    genLogger.debug('Found ' + activeNodes.length + ' active topics for hosts ');
}

function getOverRideParameters(paramName, paramArray) {
    if (paramArray.length > 0) {
        for (let j = 0; j < paramArray.length; j++) {
            if (paramArray[j].name === paramName) {
                paramArray[j].hasOwnProperty("parameters");
                return paramArray[j].parameters;
            }
        }
    }
    return null;
}

function compileServiceHost(activeService, activeNode) {
    let builtStr = {
        area: activeService.area,
        protocol: activeService.protocol,
        group: activeService.group,
        interval: activeService.interval,
        parameters: activeService.parameters,
        name: activeService.name,
        elective: activeService.elective,
        target: activeNode.targetname,
        address: activeNode.targetaddress
    };
    if (activeService.check) {
        builtStr.check = activeService.check;
    }
    if (activeService.cmd) {
        builtStr.cmd = activeService.cmd;
    }
    if (typeof (activeNode.hasOwnProperty("protocols"))) {
        let res = getOverRideParameters(activeService.protocol, activeNode.protocols);
        if (res) {
            genLogger.debug('Node "' + activeNode.targetname + '" has override parameters for "' + activeService.name + '" in group "' + activeService.group + '"');
            builtStr.parameters = res;
        }

    }
    return builtStr;
}

function buildServiceHost() {
    genLogger.info('Building service host list');
    activeServices.forEach(function (activeService) {
        activeNodes.forEach(function (activeNode) {
            if (activeService.group === activeNode.subscription) {
                if (typeof (runtimeList[activeService.interval]) === 'undefined') {
                    runtimeList[activeService.interval] = [];
                }
                runtimeList[activeService.interval].push(compileServiceHost(activeService, activeNode));
            }
        });
    });
    genLogger.info('Service host list, built.');
}

function singlePublish(queuename, payload) {
    queueLogger.debug('Sending payload to the queue broker: ' + JSON.stringify(payload));
    appQueue.publishMsg("", queuename, JSON.stringify(payload));
}

function batchPublish(queuename, payloads) {
    payloads.forEach(function (payload) {
        queueLogger.debug('Sending payload to the queue broker: ' + JSON.stringify(payload));
        payload.qtime = moment().valueOf();
        appQueue.publishMsg("", queuename, JSON.stringify(payload));
    });
}

function buildHash(msg) {
    let str = "";
    for (let k in msg) {
        if (msg.hasOwnProperty(k)) {
            str += msg[k];
        }
    }
    let hash = crypto.createHash('sha256');
    hash.update(str);
    return hash.digest('hex');
}

function runService(interval) {
    genLogger.info('Cron running for ' + interval + ' minute(s) interval');
    let payloads = [];
    let ci = 0;
    if (runtimeList[interval]) {
        runtimeList[interval].forEach(function (cronMsg) {
            cronMsg.stime = moment().valueOf();
            cronMsg.etime = moment(moment().add(Math.round((interval * 60) / 2), 'seconds')).valueOf();
            cronMsg.rdate = moment().format("YYYY/MM/DD HH:mm:ss");
            cronMsg.lifespan = ((interval * 60) / 2);
            /* build hash string */
            cronMsg.caid = buildHash(cronMsg);
            payloads.push(cronMsg);
            queueLogger.debug('publishQueueName ' + appConfig.amqp.publishQueueName + cronMsg.area);
            singlePublish(appConfig.amqp.publishQueueName + cronMsg.area, cronMsg);
            ci++;
        });
        queueLogger.info(ci + ' item(s) have been sent to the queue');
    }
}

loadServices();
flattenServices();
loadNodes();
flattenNodes();
buildServiceHost();



//cron.schedule('*/5 * * * * *', function () {
//    genLogger.debug('Running cron (*/5 * * * * *)');
//    runService('5');
//});

//cron.schedule('*/10 * * * * *', function () {
//    genLogger.debug('Running cron (*/10 * * * * *)');
//    runService('10');
//});

//cron.schedule('*/20 * * * * *', function () {
//    genLogger.debug('Running cron (*/20 * * * * *)');
//    runService('20');
//});

//cron.schedule('*/30 * * * * *', function () {
//    genLogger.debug('Running cron (*/30 * * * * *)');
//    runService('30');
//});

//cron.schedule('*/15 * * * * *', function () {
//    genLogger.debug('Running cron (*/15 * * * * *)');
//    runService('15');
//});

cron.schedule('*/1 * * * *', function () {
    strd = moment().format("YYYY/MM/DD HH:mm:ss.SSS");
    genLogger.debug('Running cron (*/1 * * * *)');
    runService('1');
});

cron.schedule('*/5 * * * *', function () {
    genLogger.debug('Running cron (*/5 * * * *)');
    runService('5');
});

cron.schedule('*/10 * * * *', function () {
    genLogger.debug('Running cron (*/10 * * * *)');
    runService('10');
});

cron.schedule('*/15 * * * *', function () {
    genLogger.debug('Running cron (*/15 * * * *)');
    runService('15');
});
 