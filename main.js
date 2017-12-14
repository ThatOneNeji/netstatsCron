var appConfig = require('./settings.json');
var appServices = require('./services.json');
var appNodes;
var log4js = require('log4js');
var moment = require('moment');

var logger = log4js.getLogger('netstatsNodeCronSNMP');

var cron1 = require('node-cron');
var cron5 = require('node-cron');
var cron10 = require('node-cron');
var cron15 = require('node-cron');

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

function runService(mib) {
    var tn = getNodes(appConfig.nodes, mib);
    var tn_size = tn.length;
    if (tn_size > 0) {
        rDate = moment().format("YYYY/MM/DD HH:mm:00");
        startTime = moment().unix();
        endTime = moment(moment().add(240, 'seconds')).unix();
        for (var d = 0; d < tn_size; d++) {
            msg = {};
            msg.stime = startTime;
            msg.etime = endTime;
            msg.rdate = rDate;
            msg.mib = mib;
            msg.target = tn[d];
            publisher(appConfig.amqp.queuename, msg);
            logger.info(msg);
        }
    } else {
        logger.info("No nodes have subscribed to the service: " + mib);
    }
}

function inArray(needle, haystack) {
    var length = haystack.length;
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
            newMsg = {};
            newMsg.service = appServices.summary['name'];
            newMsg.sql = appServices.summary.update_sql[i];
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
        console.log(appNodes);
    } else {
        logger.debug('No reload node service for interval: ' + interval);
    }
}

function runUpdates() {
    if (appServices.summary['enabled']) {
        runSummary();
    }

    if (appServices.summary['enabled']) {
        runReloadNodes();
    }
}

cron1.schedule('* * * * *', function () {
    strd = moment().format("YYYY/MM/DD HH:mm:ss.SSS");
    logger.debug('Running cron (* * * * *)');
    runUpdates();

});

cron5.schedule('*/5 * * * *', function () {
    logger.debug('Running cron (*/5 * * * *)');
//    runService('host_resources_processor');
    //  runService('mikrotik_queuetree');
//    runService('host_resources_storage');
    //runService('ifmib');
    //runService('mikrotik_ap_client');
});

cron10.schedule('*/10 * * * *', function () {
    logger.debug('Running cron (*/10 * * * *)');
});

cron15.schedule('*/15 * * * *', function () {
    logger.debug('Running cron (*/15 * * * *)');
});
