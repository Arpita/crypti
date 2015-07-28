/**
 * Ask Sebastian if you have any questions. Last Edit: 15/07/2015
 */

'use strict';

// Requires and node configuration
var _ = require('lodash'),
	config = require('./config.json'),
    expect = require('chai').expect,
    supertest = require('supertest'),
    baseUrl = 'http://' + config.address + ':' + config.port,
    api = supertest(baseUrl + '/api'), // DEFINES THE NODE WE USE FOR THE TEST
	peer = supertest(baseUrl + '/peer'), // DEFINES THE NODE WE USE FOR PEER TESTS
	async = require('async'),
    request = require('request');

var normalizer = 100000000; // Use this to convert XCR amount to normal value
var blockTime = 10000; // Block time in miliseconds
var blockTimePlus = 12000; // Block time + 2 seconds in miliseconds
var version = "0.3.1" // Node version

// Holds Fee amounts for different transaction types.
var Fees = {
    voteFee : 100000000,
    usernameFee : 100000000,
    followFee : 100000000,
    transactionFee : 0.001,
    secondPasswordFee : 500000000,
    delegateRegistrationFee : 10000000000
};

// Account info for delegate to register manually
var Daccount = {
    'address': '9946841100442405851C',
    'publicKey': 'caf0f4c00cf9240771975e42b6672c88a832f98f01825dda6e001e2aab0bc0cc',
    'password': "1234",
    'secondPassword' : "12345",
    'balance': 0,
    'delegateName':'sebastian',
    'username':'bdevelle'
};

// Existing delegate account in blockchain
var Eaccount = {
    'address': '17604940945017291637C',
    'publicKey': 'f143730cbb5c42a9a02f183f8ee7b4b2ade158cb179b12777714edf27b4fcf3e',
    'password': "GwRr0RlSi",
    'balance': 0,
    'delegateName': 'genesisDelegate100'
};

// List of all transaction types codes
var TxTypes = {
    SEND : 0,
    SIGNATURE : 1,
    DELEGATE : 2,
    VOTE : 3,
    USERNAME : 4,
    FOLLOW : 5,
    MESSAGE : 6,
    AVATAR : 7,
    MULTI: 8
};

// Account info for foundation account - XCR > 1,000,000 | Needed for voting, registrations and Tx
var Faccount = {
    'address': '2334212999465599568C',
    'publicKey': '631b91fa537f74e23addccd30555fbc7729ea267c7e0517cbf1bfcc46354abc3',
    'password': "F3DP835EBuZMAhiuYn2AzhJh1lz8glLolghCMD4X8lRh5v2GlcBWws7plIDUuPjf3GUTOnyYEfXQx7cH",
    'balance': 0
};

// Random XCR Amount
var XCR = Math.floor(Math.random() * (100000 * 100000000)) + 1; // remove 1 x 0 for reduced fees (delegate + Tx)

// Used to create random delegates names
function randomDelegateName()
{
    var size = randomNumber(1,20); // Min. delegate name size is 1, Max. delegate name is 20
    var delegateName = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$&_.";

    for( var i=0; i < size; i++ )
        delegateName += possible.charAt(Math.floor(Math.random() * possible.length));

    return delegateName;
}

// Randomizes XCR amount
function randomizeXCR(){
    return Math.floor(Math.random() * (10000 * 100000000)) + 1;
}
// Returns current block height
function getHeight(cb) {
    request({
        type: "GET",
        url: baseUrl + "/api/blocks/getHeight",
        json: true
    }, function (err, resp, body) {
        if (err || resp.statusCode != 200) {
            return cb(err || "Status code is not 200 (getHeight)");
        } else {
            return cb(null, body.height);
        }
    })
}

function onNewBlock(cb) {
	getHeight(function (err, height) {
		console.log("height: " + height);
		if (err) {
			return cb(err);
		} else {
			waitForNewBlock(height, cb);
		}
	});
}

// Function used to wait until a new block has been created
function waitForNewBlock(height, cb) {
	var actualHeight = height;
	async.doWhilst(
		function (cb) {
            request({
                type: "GET",
                url: baseUrl + "/api/blocks/getHeight",
                json: true
            }, function (err, resp, body) {
                if (err || resp.statusCode != 200) {
                    return cb(err || "Got incorrect status");
                }

                if (height + 2 == body.height) {
                    height = body.height;
                }

                setTimeout(cb, 1000);
            });
		},
		function () {
			return actualHeight == height;
		},
		function (err) {
			if (err) {
				return setImmediate(cb, err);
			} else {
				return setImmediate(cb, null, height);
			}
		}
	)
}

// Adds peers to local node
function addPeers(numOfPeers, cb) {
    var operatingSystems = ['win32','win64','ubuntu','debian', 'centos'];
    var ports = [4060, 5060, 8040, 7040];
    var sharePortOptions = [0,1];
    var os,version,port,sharePort;

    var i = 0;
    async.whilst(function () {
        return i < numOfPeers
    }, function (next) {
        os = operatingSystems[randomizeSelection(operatingSystems.length)];
        version = config.version;
        port = ports[randomizeSelection(ports.length)];
        // sharePort = sharePortOptions[randomizeSelection(sharePortOptions.length)];

        request({
            type: "GET",
            url: baseUrl + "/peer/height",
            json: true,
            headers: {
                'version': version,
                'port': port,
                'share-port': 0,
                'os': os
            }
        }, function (err, resp, body) {
            console.log(body);
            if (err || resp.statusCode != 200) {
                return next(err || "Status code is not 200 (getHeight)");
            } else {
                i++;
                next();
            }
        })
    }, function (err) {
        return cb(err);
    });
}

// Used to randomize selecting from within an array. Requires array length
function randomizeSelection(length){
    return Math.floor(Math.random() * length);
}

// Returns a random number between min (inclusive) and max (exclusive)
function randomNumber(min, max) {
    return  Math.floor(Math.random() * (max - min) + min);
}

// Calculates the expected fee from a transaction
function expectedFee(amount){
    return parseInt(amount * Fees.transactionFee);
}

// Used to create random usernames
function randomUsername(){
    var size = randomNumber(1,16); // Min. username size is 1, Max. username size is 16
    var username = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$&_.";

    for( var i=0; i < size; i++ )
        username += possible.charAt(Math.floor(Math.random() * possible.length));

    return username;
}

function randomCapitalUsername(){
    var size = randomNumber(1,16); // Min. username size is 1, Max. username size is 16
    var username = "A";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$&_.";

    for( var i=0; i < size-1; i++ )
        username += possible.charAt(Math.floor(Math.random() * possible.length));

    return username;
}

// Used to create random basic accounts
function randomAccount(){
    var account = {
        'address' : '',
        'publicKey' : '',
        'password' : "",
        'secondPassword': "",
        'delegateName' : "",
        'username':"",
        'balance': 0
    };

    account.password = randomPassword();
    account.secondPassword = randomPassword();
    account.delegateName = randomDelegateName();
    account.username =  randomUsername();

    return account;
}

// Used to create random transaction accounts (holds additional info to regular account)
function randomTxAccount(){
    return _.defaults(randomAccount(), {
        sentAmount:'',
        paidFee: '',
        totalPaidFee: '',
        transactions: []
    })
}

// Used to create random passwords
function randomPassword(){
    return Math.random().toString(36).substring(7);
}

// Exports variables and functions for access from other files
module.exports = {
    api: api,
	peer : peer,
	crypti : require('./cryptijs'),
    supertest: supertest,
    expect: expect,
    version: version,
    XCR: XCR,
    Faccount: Faccount,
    Daccount: Daccount,
    Eaccount: Eaccount,
    TxTypes: TxTypes,
    Fees: Fees,
    normalizer: normalizer,
    blockTime: blockTime,
    blockTimePlus: blockTimePlus,
    randomDelegateName: randomDelegateName,
    randomizeXCR: randomizeXCR,
    randomPassword: randomPassword,
    randomAccount: randomAccount,
    randomTxAccount: randomTxAccount,
    randomUsername: randomUsername,
    randomNumber: randomNumber,
    randomCapitalUsername: randomCapitalUsername,
    expectedFee:expectedFee,
    addPeers:addPeers,
	peers_config: config.mocha.peers,
	config: config,
	waitForNewBlock: waitForNewBlock,
	getHeight: getHeight,
	onNewBlock: onNewBlock
};