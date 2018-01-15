var appConfig = require('./settings.json');
var appServices = require('./services.json');
var appProtocol = require('./protocols.json');
var appNodes;
var log4js = require('log4js'), moment = require('moment'), logger = log4js.getLogger('netstatsNodeCron'), cron1 = require('node-cron'), cron5 = require('node-cron'), cron10 = require('node-cron'), cron15 = require('node-cron');
function initLogger() {
    log4js.configure(appConfig.logger);
}

function initLoadNodes() {
    appNodes = require('./nodes.json');
}

initLogger();
logger.info('Starting...');
var open = require('amqplib').connect('amqp://' + appConfig.amqp.user + ':' + appConfig.amqp.password + '@' + appConfig.amqp.server);
function getIndex(target_array, service) {
    var array_size = target_array.length;
    for (var j = 0; j < array_size; j++) {
        if (service === target_array[j]['name']) {
            return j;
        }
    }
    return false;
}

function getNodes(target_array, service) {
    var array_size = target_array.length;
    var target_nodes = [];
    for (var n = 0; n < array_size; n++) {
        if (target_array[n]['enabled']) {
            var node_size = target_array[n]['services'].length;
            for (var a = 0; a < node_size; a++) {
                if (target_array[n]['services'][a] === service) {
                    target_nodes.push(target_array[n]['ip_address']);
                }
            }
        }
    }
    return target_nodes;
}

function getProtocolsByInterval(target_array, interval) {
    var res = [];
    var array_size = target_array.length;
    for (var n = 0; n < array_size; n++) {
        var protocol_service = {};
        if (target_array[n]['enabled']) {
            logger.debug('Protocol: ' + target_array[n]['type'] + ' (enabled)');
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
                        logger.debug('Service found: ' + serviceData.name + ' for protocol: ' + target_array[n]['type'] + ' age: ' + serviceData.age + ' second(s)');
                    }
                    data.services = protocol_service;
                }
            }
            if (data.services) {
                res.push(data);
            }
        } else {
            logger.debug('Protocol: ' + target_array[n]['type'] + ' (disabled)');
        }
    }
    return res;
}

function publisher(queuename, msg) {
    open.then(function (conn) {
        return conn.createChannel();
    }).then(function (ch) {
        return ch.assertQueue(queuename).then(function (ok) {
            ch.sendToQueue(queuename, new Buffer(JSON.stringify(msg)));
            try {
                return ch.close();
            } catch (alreadyClosed) {
                logger.error(alreadyClosed.stackAtStateChange);
            }
        });
    }).catch(console.warn);
}

function getTargetsForServices(source_array) {
    var source_size = source_array.length;
    for (var t = 0; t < source_size; t++) {
        logger.debug('Protocol ' + source_array[t]['protocol']);
        var service_size = source_array[t]['services'].length;
        for (var s = 0; s < service_size; s++) {
            var tn = getNodes(appNodes.nodes, source_array[t]['services'][s]['name']);
            var tn_size = tn.length;
            if (tn_size > 0) {
                for (var d = 0; d < tn_size; d++) {
                    let msg = {
                        stime: moment().unix(),
                        etime: moment(moment().add(source_array[t]['services'][s]['age'], 'seconds')).unix(),
                        rdate: moment().format("YYYY/MM/DD HH:mm:00"),
                        service: source_array[t]['services'][s],
                        target: tn[d]
                    };
                    logger.info('Queue: ' + appConfig.amqp.queuename + source_array[t]['protocol'] + ' Msg: ' + JSON.stringify(msg));
                    publisher(appConfig.amqp.queuename + source_array[t]['protocol'], msg);
                }
            } else {
                logger.info("No nodes have subscribed to the service: " + source_array[t]['services'][s]['name']);
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
    if (inArray(interval, appServices.summary['intervals'])) {
        logger.debug('Running summaries service for interval: ' + interval);
        var lengthT = appServices.summary.update_sql.length;
        for (var i = 0; i < lengthT; i++) {
            let newMsg = {
                service: appServices.summary['name'] + '___' + appServices.summary.update_sql[i]['name'],
                sql: appServices.summary.update_sql[i]
            };
            publisher(appServices.summary['queuename'], newMsg);
        }
    } else {
        logger.debug('No summaries service for interval: ' + interval);
    }
}

function runReloadNodes() {
    interval = moment().format("mm");
    if (inArray(interval, appServices.reloadnodes['intervals'])) {
        logger.debug('Running reload node service for interval: ' + interval);
        initLoadNodes();
    } else {
        logger.debug('No reload node service for interval: ' + interval);
    }
}

function runUpdates() {
    if (appServices.summary['enabled'])
        runSummary();
    if (appServices.reloadnodes['enabled'])
        runReloadNodes();
}

initLoadNodes();
cron1.schedule('* * * * *', function () {
    strd = moment().format("YYYY/MM/DD HH:mm:ss.SSS");
    logger.info('Running cron (* * * * *)');
    runUpdates();
    runService('1');
});
cron5.schedule('*/5 * * * *', function () {
    logger.info('Running cron (*/5 * * * *)');
    runService('5');
});
cron10.schedule('*/10 * * * *', function () {
    logger.info('Running cron (*/10 * * * *)');
    runService('10');
});
cron15.schedule('*/15 * * * *', function () {
    logger.info('Running cron (*/15 * * * *)');
    runService('15');
});
