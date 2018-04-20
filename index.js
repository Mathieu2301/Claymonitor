var config = require('./config.json');
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
const socket = require('net');
var { Client } = require('tplink-smarthome-api');

var rig_infos = {
	hashrate: 0.0,
	shares: 0,
	cards: [],
	pool: ""
}

const client = new Client();
app.use(require('express').static(__dirname + "/http"));

io.on('connection', function(ioclient){
		console.log("Connect : " + ioclient)

		ioclient.on('setPlugOn', function(){
			const plug = client.getDevice({host: config.tplink_wattmetter_ip}).then((device)=>{
				device.setPowerState(true);
			});
		});
		ioclient.on('setPlugOff', function(){
			const plug = client.getDevice({host: config.tplink_wattmetter_ip}).then((device)=>{
				device.setPowerState(false);
			});
		});

		function sendInfos(){
			const plug = client.getDevice({host: config.tplink_wattmetter_ip}).then((device)=>{
				ioclient.emit('infos', {rig: rig_infos, plug: device.getInfo()})
			});
		}
		var interval = setInterval(sendInfos, config.claymore_remote_interval);
});

function getRigInfos() {
  var s = socket.Socket();
	s.setEncoding('ascii');
	s.on('data', function(d) {
		var rs = JSON.parse(d);
		if (rs.error == null){
			rig_infos.hashrate = (rs.result[2].split(";")[0])/1000;
			rig_infos.shares = rs.result[2].split(";")[1];
			rig_infos.pool = rs.result[7];
			var num = 0;

			var cards = [];
			rs.result[3].split(";").forEach(element => {
				cards.push({
					hashrate: element/1000,
					temp: rs.result[6].split(";")[num*2],
					fan: rs.result[6].split(";")[num*2+1]
				})
				
				++num;
			});

			rig_infos.cards = cards;
		}else{
			console.log("Erreur, " + rs.error);
		}
	});
	s.connect(config.claymore_remote_port, config.claymore_remote_ip);
	s.write('{"id":0,"jsonrpc":"2.0","method":"miner_getstat1"}');
	s.end();
}

// END
getRigInfos();
setInterval(getRigInfos, config.claymore_remote_interval);
server.listen(80);