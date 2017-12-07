var appConfig = require('./settings.json');
var log4js = require('log4js');
var moment = require('moment');

var logger = log4js.getLogger('wugmsNodeCronSNMP');

var cron1 = require('node-cron');
var cron5 = require('node-cron');
var cron10 = require('node-cron');
var cron15 = require('node-cron');

function initLogger() {
    log4js.configure({
        appenders: {
            out: {type: 'console'},
            task: {
                type: 'file',
                filename: 'logs/wugmsNodeCronSNMP.log',
                maxLogSize: 1048576,
                backups: 10
            }
        },
        categories: {
            default: {appenders: ['out', 'task'], level: 'debug'},
            task: {appenders: ['task'], level: 'error'}
        }
    });
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
            logger.debug(alreadyClosed.stackAtStateChange);
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

function runUpdates() {
    if (appConfig.summary['enabled']) {
        interval = moment().format("mm");
        logger.debug('Running updates');
        if (inArray(interval, appConfig.summary['intervals'])) {
            var lengthT = appConfig.summary.update_sql.length;
            for (var i = 0; i < lengthT; i++) {
                newMsg = {};
                newMsg.service = appConfig.summary['name'];
                newMsg.sql = appConfig.summary.update_sql[i];
                publisher(appConfig.summary['queuename'], newMsg);
            }
        } else {
            logger.debug('No updates to run for update service interval -> ' + interval);
        }
    } else {
        logger.debug('Update service not enabled');
    }
}

cron1.schedule('* * * * *', function () {
    strd = moment().format("YYYY/MM/DD HH:mm:ss.SSS");
    logger.debug('Running cron (* * * * *)');
    runUpdates();

    //runService('mikrotik_queuetree');
});

cron5.schedule('*/5 * * * *', function () {
    logger.debug('Running cron (*/5 * * * *)');
    runService('host_resources_processor');
    runService('mikrotik_queuetree');
//    runService('host_resources_storage');
    runService('ifmib');
    runService('mikrotik_ap_client');
});

cron10.schedule('*/10 * * * *', function () {
    logger.debug('Running cron (*/10 * * * *)');
});

cron15.schedule('*/15 * * * *', function () {
    logger.debug('Running cron (*/15 * * * *)');
//    runService('mikrotik_queuetree');
});
