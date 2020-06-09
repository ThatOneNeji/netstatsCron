/* version 1.2.0 */
// Declare any/all external libs
var amqp = require('amqp-connection-manager');
var moment = require('moment');

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
     * @function cleanQueueName
     * @param {string} name This is the queuename that needs to be cleaned
     * @return {string} This should only contain a-Z characters
     * @description This function cleans up the queuename that is to be used
     */
    function cleanQueueName(name) {
        return name.replace(/,/g, '').replace(/_/g, '').replace(/\./g, '').replace(/\//g, '');
    }

    /**
     * @typedef {Object} messageFields
     * @property {string} consumerTag consumerTag
     * @property {number} deliveryTag deliveryTag
     * @property {boolean} redelivered redelivered
     * @property {string} exchange exchange
     * @property {string} routingKey routingKey
     * @description description
     */
    /**
     * @typedef {Object} messageProperties
     * @property {*} contentType undefined
     * @property {*} contentEncoding undefined
     * @property {*} headers undefined
     * @property {*} deliveryMode undefined
     * @property {*} priority undefined
     * @property {*} correlationId undefined
     * @property {*} replyTo undefined
     * @property {*} expiration undefined
     * @property {*} messageId undefined
     * @property {*} timestamp undefined
     * @property {*} type undefined
     * @property {*} userId undefined
     * @property {*} appId undefined
     * @property {*} clusterId undefined
     * @description description
     */
    /**
     * @typedef {Object} messageRecieved
     * @property {messageFields} fields messageFields
     * @property {messageProperties} properties properties
     * @property {Buffer} content content
     * @description description
     */
    /**
     * @function onMessage
     * @param {messageRecieved} data description
     * @description description
     */
    var onMessage = function(data) {
        let instanceName = cleanQueueName(data.fields.routingKey);
        if (externalHandover(data)) {
            receiveChannelObject[instanceName].ack(data);
        }
    }

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
     * @function buildAMQPURL
     * @param {messageBrokerServerSettings} config Array of possible message borker servers
     * @return {array} URLs of AMQP enabled message brokers
     * @description This function builds the URLs to use for AMQP connections
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
     * @function createConsumerQueue
     * @param {string} queueName 
     * @description This function creates a consumer queue
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
     * @function initialisePublishQueue 
     * @param {string} queueName Name to use for the publsih queue
     * @description This function creates a publiching queue
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
     * @typedef {Object} messageBrokerOptions
     * @property {function} logger Logger to pass on to the messagebroker so that it can log messages
     * @property {messageBrokerServerSettings} config Configuration for the RabbitMQ server
     * @property {string} receiveQueue This is the queue to consume from
     * @property {string} receiveQueueName This is the name of the consume instance
     * @property {function} externalHandover This function is called from the message broker in order to action incoming data
     * @description description
     */
    /**
     * @function init 
     * @param {messageBrokerOptions} options Name to use for the publsih queue
     * @description his function initialisies the messagebroker
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
     * @typedef {Object} messageDataPacket
     * @property {string} qtime Time when the message broker sub system received the msg
     * @property {string} data 
     * @description description
     */
    /**
     * @typedef {Object} queueMessageType
     * @property {string} queuename Name of the queue that the data needs to be sent to
     * @property {messageDataPacket} data description
     * @description description
     */
    /**
     * @function postMessageToQueue
     * @param {queueMessageType} msg description
     * @return {any} Result of the pushling
     * @description description
     */
    function postMessageToQueue(msg) {
        publishChannelWrapper.sendToQueue(msg.queuename, msg.data)
            .then(function(ok) {
                if (!ok) {
                    Logging.debug('publishChannelWrapper:' + ok);
                }
                // eslint-disable-next-line no-unused-vars
                let returnMessage = 'Sent message "';
                returnMessage += msg.data.caid;
                returnMessage += '" for "';
                returnMessage += msg.data.service;
                returnMessage += '" to "';
                returnMessage += msg.queuename;
                returnMessage += '"'
                return Logging.debug(returnMessage);
                //return true;
            }).catch(function(err) {
                return Logging.error(err);
            });
    }

    /**
     * @function createPublishQueue
     * @param {string} queueName description
     * @return {any} Result of the pushling
     * @description description
     */
    this.createPublishQueue = function(queueName) {
        publishChannelWrapper.addSetup(function(channel) {
            return Promise.all([
                channel.assertQueue(queueName, { durable: true })
            ]);
        });
    };

    /**
     * @function queuePostTime
     * @return {string} Epoch value for current time
     * @description This function returns the current time as a epoch value
     */
    function queuePostTime() {
        return moment().valueOf();
    }

    /**
     * @function singlePublish
     * @param {queueMessageType} payload description
     * @description This function publishes a single msg
     */
    this.singlePublish = function(payload) {
        payload.data.qtime = queuePostTime();
        postMessageToQueue(payload);
    }

    /**
     * @function batchPublish
     * @param {array} payloads This is an array of msgs to be posted
     * @return {boolean} Successful is true
     * @description description
     */
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