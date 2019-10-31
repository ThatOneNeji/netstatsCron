//Load external libs
var amqp = require('amqp-connection-manager');
var moment = require('moment');
// //var util = require('util');

function messagebroker() {
    var connection;
    var publishChannelWrapper;
    //    var receiveChannelWrapper;
    var receiveChannelObject = {};
    var settings;
    var Logging;
    var receiveQueue;
    var receiveQueueName;
    var publishQueue;
    var externalHandover;



    /**
     * 
     * @param {string} name This is the queuename that needs to be cleaned
     * @return {string} This should only contain a-Z characters
     */
    function cleanQueueName(name) {
        return name.replace(/,/g, '').replace(/_/g, '').replace(/\./g, '').replace(/\//g, '');
    }

    var onMessage = function(data) {
        let instanceName = cleanQueueName(data.fields.routingKey);
        //     console.log('11111');
        if (externalHandover(data)) {
            //          console.log('22222');
            receiveChannelObject[instanceName].ack(data);
            //       console.log('33333');
        }
        //     console.log('44444');
    }

    /**
     * @typedef {Object} messageBrokerServerSettings
     * @property {string} host Host name or address to use
     * @property {string} user Username to use
     * @property {string} password Pasword for above listed username
     * @property {string} port Port for host (optional)
     * @property {string} vhost The vhost to use (optional)
     * @property {string} active If this host should be used or not (optional)
     * @description This object contains the configuration information for the 
     *     message broker sub system
     */
    /**
     * 
     * @param {messageBrokerServerSettings} config 
     */
    function buildAMQPURL(config) {
        let messagebrokerservers = [];
        config.forEach(server => {
            if (server.active) {
                let srvinstance = 'amqp://';
                if (server.user && server.password) {
                    srvinstance += server.user + ':' + server.password + '@'
                }
                srvinstance += server.host;
                if (server.port) {
                    srvinstance += ':' + server.port;
                }
                /*                 if (server.vhost) {
                                    srvinstance += '/' + server.vhost;
                                } */
                messagebrokerservers.push(srvinstance);
            }
        });
        return messagebrokerservers;
    }

    /**
     * 
     * @param {string} queueName 
     */
    function createConsumerQueue(queueName) {
        let instanceName = cleanQueueName(queueName);
        Logging.debug('Initialising receiving queue: "' + queueName + '", instance name: "' + instanceName + '"');
        receiveChannelObject[instanceName] = connection.createChannel({
            setup: function(channel) {
                return Promise.all([
                    channel.assertQueue(queueName, { durable: true }),
                    channel.prefetch(1),
                    channel.consume(queueName, onMessage)
                ]);
            }
        });
    }
    /**
     * initialisePublishQueue 
     * @param {string} QueueName Name to use for the publsih queue
     */
    function initialisePublishQueue(queueName) {
        if (queueName) {
            publishChannelWrapper = connection.createChannel({
                json: true,
                setup: function(channel) {
                    return channel.assertQueue(queueName, { durable: true });
                }
            });
            Logging.debug('Publish queue "' + queueName + '" has been created');
        } else {
            Logging.warn('Publish queue name was not supplied');
        }
    }

    /**
     * This function initialisies the messagebroker
     *
     * @typedef {Object} messagebrokerOptions
     * @property {function} logger Logger to pass on to the messagebroker 
     *     so that it can log messages
     * @property {messageBrokerServerSettings} config Configuration for the RabbitMQ server
     * @property {string} receiveQueue This is the queue to consume from
     * @property {string} receiveQueueName This is the name of the consume instance
     * @property {function} externalHandover This function is called from 
     *     the message broker in order to action incoming data
     *
     */
    this.init = function(options = {}) {
        Logging = options.logger;
        Logging.info('Initialising message broker');
        settings = options.config;
        receiveQueue = options.receiveQueue || false;
        publishQueue = options.publishQueueName || false;
        receiveQueueName = options.receiveQueue || false;
        externalHandover = options.externalHandover || false;
        connection = amqp.connect(buildAMQPURL(settings));
        connection.on('connect', function(connection) {
            Logging.debug('Connected to: ' + connection.url);
            if (receiveQueue) {
                createConsumerQueue(receiveQueue, receiveQueueName);
            }
        });

        connection.on('disconnect', function(err) {
            Logging.error(err)
        });

        initialisePublishQueue(publishQueue);
    };



    /**
     * @typedef {Object} queuemessagetype
     * @property {string} queuename 
     * @property {string} data 
     * data.qtime
     */

    /**
     * 
     * @param {queuemessagetype} msg 
     */
    function postMessageToQueue(msg) {
        publishChannelWrapper.sendToQueue(msg.queuename, msg.data)
            .then(function(ok) {
                if (!ok) {
                    Logging.debug('publishChannelWrapper:' + ok);
                }
                let returnMessage = 'Sent message "';
                returnMessage += msg.data.caid;
                returnMessage += '" for "';
                returnMessage += msg.data.service;
                returnMessage += '" to "';
                returnMessage += msg.queuename;
                returnMessage += '"'
                    //return Logging.debug(returnMessage);
                return true;
            }).catch(function(err) {
                return Logging.error(err);
            });
    }

    this.createPublishQueue = function(queueName) {
        publishChannelWrapper.addSetup(function(channel) {
            return Promise.all([
                channel.assertQueue(queueName, { durable: true })
            ]);
        });
    };

    function queuePostTime() {
        return moment().valueOf();
    }

    this.singlePublish = function(payload) {
        payload.data.qtime = queuePostTime();
        postMessageToQueue(payload);
    }

    this.batchPublish = function(payloads) {
        payloads.forEach(function(payload) {
            if (payload.data) {
                payload.data.qtime = queuePostTime();
            }
            postMessageToQueue(payload);
        });
        return true;
    }

}

module.commandName = 'MessageBroker';
module.exports = new messagebroker();
module.helpText = 'General message broker sub system';