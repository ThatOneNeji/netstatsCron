var appConfig = require('./settings.json');
var appInternalServices = require('./internalservices.json');
var appProtocol = require('./protocols.json');
var appNodes;

var log4js = require('log4js'), moment = require('moment'), cron = require('node-cron');

var genLogger = log4js.getLogger('netstatsNodeCron');
var amqpLogger = log4js.getLogger('AMQP');
var messageLogger = log4js.getLogger('messages');

log4js.configure(appConfig.logger);

function initLoadNodes() {
    appNodes = require('./nodes.json');
}

genLogger.info('Starting...');

var broker = require('amqplib').connect('amqp://' + appConfig.amqp.user + ':' + appConfig.amqp.password + '@' + appConfig.amqp.server);
function getIndex(target_array, service) {
    var array_size = target_array.length;
    for (var j = 0; j < array_size; j++) {
        if (service === target_array[j]['name']) {
            return j;
        }
    }
    return false;
}

function getNodes(targetArray, service) {
    var targetNodes = [];
    targetArray.forEach(function (node) {
        if ((node.enabled) && (String(node.services) === service)) {
            let targetNode = {
                address: node.ip_address,
                protocols: node.protocols
            };
            targetNodes.push(targetNode);
        }
    });
    return targetNodes;
}

function getProtocolsByInterval(target_array, interval) {
    var res = [];
    var array_size = target_array.length;
    for (var n = 0; n < array_size; n++) {
        var protocol_service = {};
        if (target_array[n]['enabled']) {
            messageLogger.debug('Protocol: ' + target_array[n]['type'] + ' (enabled)');
            let interval_size = target_array[n]['intervals'].length;
            let protocol_service = [];
            let data = {};
            data.protocol = target_array[n]['type'];
            for (var i = 0; i < interval_size; i++) {
                if ((target_array[n]['intervals'][i]['value'] === interval) && (target_array[n]['intervals'][i]['enabled'])) {
                    var service_size = target_array[n]['intervals'][i]['services'].length;
                    for (var j = 0; j < service_size; j++) {
                        var serviceData = {
                            name: target_array[n]['intervals'][i]['services'][j],
                            age: target_array[n]['intervals'][i]['age']
                        };
                        protocol_service.push(serviceData);
                        messageLogger.debug('Service: "' + serviceData.name + '" Protocol: "' + target_array[n]['type'] + '" Age: "' + serviceData.age + '" second(s)');
                    }
                    data.services = protocol_service;
                }
            }
            if (data.services) {
                res.push(data);
            }
        } else {
            messageLogger.debug('Protocol: ' + target_array[n]['type'] + ' (disabled)');
        }
    }
    return res;
}

function batchPublish(queuename, payloads) {
    broker.then(function (conn) {
        return conn.createChannel();
    }).then(function (ch) {
        return ch.assertQueue(queuename).then(function (ok) {
            payloads.forEach(function (payload) {
                amqpLogger.debug('Sending payload to the queue broker: ' + JSON.stringify(payload));
                ch.sendToQueue(queuename, new Buffer(JSON.stringify(payload)));
            });
            try {
                return ch.close();
            } catch (alreadyClosed) {
                amqpLogger.error(alreadyClosed.stackAtStateChange);
            }
        });
    }).catch(amqpLogger.warn);
}

function getElementDataByName(parray, ename) {
    for (var f = 0; f < parray.length; f++) {
        if (parray[f]['type'] === ename) {
            var procotolInfo = {
                name: parray[f]['name'],
                port: parray[f]['port']
            };
        }
    }
    return procotolInfo;
}


function getTargetsForServices(source_array) {
    var source_size = source_array.length;
    var payloads = [];
    for (var t = 0; t < source_size; t++) {
        messageLogger.debug('Protocol ' + source_array[t]['protocol']);
        var service_size = source_array[t]['services'].length;
        for (var s = 0; s < service_size; s++) {
            var tn = getNodes(appNodes.nodes, source_array[t]['services'][s]['name']);
            var tn_size = tn.length;
            if (tn_size > 0) {
                for (var d = 0; d < tn_size; d++) {
                    let protocolData = getElementDataByName(tn[d].protocols, source_array[t]['protocol']);
                    let msg = {
                        stime: moment().unix(),
                        etime: moment(moment().add(source_array[t]['services'][s]['age'], 'seconds')).unix(),
                        rdate: moment().format("YYYY/MM/DD HH:mm:00"),
                        service: source_array[t]['services'][s]['name'],
                        target: tn[d].address,
                        name: protocolData['name'],
                        port: protocolData['port']
                    };
                    messageLogger.info('Queue: ' + appConfig.amqp.queuename + source_array[t]['protocol'] + ' Msg: ' + JSON.stringify(msg));
                    payloads.push(msg);
                }
                batchPublish(appConfig.amqp.queuename + source_array[t]['protocol'], payloads);
            } else {
                messageLogger.info("No nodes have subscribed to the service: " + source_array[t]['services'][s]['name']);
            }
        }
    }
}

function runService(interval) {
    getTargetsForServices(getProtocolsByInterval(appProtocol.protocols, interval));
}

function inArray(needle, haystack) {
    let length = haystack.length;
    for (var i = 0; i < length; i++) {
        if (haystack[i] === needle)
            return true;
    }
    return false;
}

function runSummary() {
    interval = moment().format("mm");
    if (inArray(interval, appInternalServices.summary['intervals'])) {
        genLogger.debug('Running summaries service for interval: ' + interval);
        var lengthT = appInternalServices.summary.update_sql.length;
        for (var i = 0; i < lengthT; i++) {
            let newMsg = {
                service: appInternalServices.summary['name'] + '___' + appInternalServices.summary.update_sql[i]['name'],
                sql: appInternalServices.summary.update_sql[i]
            };
            publisher(appInternalServices.summary['queuename'], newMsg);
        }
    } else {
        genLogger.debug('No summaries service for interval: ' + interval);
    }
}

function runReloadNodes() {
    interval = moment().format("mm");
    if (inArray(interval, appInternalServices.reloadnodes['intervals'])) {
        genLogger.debug('Running reload node service for interval: ' + interval);
        initLoadNodes();
    } else {
        genLogger.debug('No reload node service for interval: ' + interval);
    }
}

function runUpdates() {
    if (appInternalServices.summary['enabled']) {
        runSummary();
    }
    if (appInternalServices.reloadnodes['enabled']) {
        runReloadNodes();
    }
}

initLoadNodes();
cron.schedule('* * * * *', function () {
    strd = moment().format("YYYY/MM/DD HH:mm:ss.SSS");
    genLogger.info('Running cron (* * * * *)');
    runUpdates();
    runService('1');
});
cron.schedule('*/5 * * * *', function () {
    genLogger.info('Running cron (*/5 * * * *)');
    runService('5');
});
cron.schedule('*/10 * * * *', function () {
    genLogger.info('Running cron (*/10 * * * *)');
    runService('10');
});
cron.schedule('*/15 * * * *', function () {
    genLogger.info('Running cron (*/15 * * * *)');
    runService('15');
});
