var config = require('./config.json');
var validated_config = false;

const electron = require('electron')
const electron_app = electron.app
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')

let mainWindow

function createWindow () {

  mainWindow = new BrowserWindow({width: 1280, height: 720})

  var url;
  if (!validated_config){
    mainWindow.loadURL("http://localhost/settings.html")
  }else{
    mainWindow.loadURL("http://localhost/")
  }

  mainWindow.on('closed', function () {
    mainWindow = null
  })
}

electron_app.on('ready', createWindow)

electron_app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    electron_app.quit()
  }
})

electron_app.on('activate', function () {
  if (mainWindow === null) {
    createWindow()
  }
})

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var fs = require('fs')
const socket = require('net');
require('path');

var rig_infos = {
	hashrate: 0.0,
	shares: 0,
	cards: [],
	pool: "localhost:9999"
}

app.use(require('express').static(__dirname + "/http"));

io.on('connection', function(ioclient){
  
  ioclient.emit('config', config)

  ioclient.on('changeConfig', function(newconfig){
    config = newconfig;
    ioclient.broadcast.emit('config', config)
    validated_config = true;
    var json = JSON.stringify(config); 
    fs.writeFile('./config.json', json);
  })

	function sendInfos(){
    ioclient.emit('infos', {rig: rig_infos})
	}
	var interval = setInterval(sendInfos, config.claymore_remote_interval);
});

function changeRigInfos() {
  if (validated_config) {
    rig_infos = getRigInfos(config.claymore_remote_port, config.claymore_remote_ip);
  }
}

function getRigInfos(rig_port, rig_ip) {
  if (validated_config) {
    var rinfos = {}
    var s = socket.Socket();
    s.setEncoding('ascii');
    s.on('data', function(d) {
      var rs = JSON.parse(d);
      if (rs.error == null){
        rinfos.hashrate = (rs.result[2].split(";")[0])/1000;
        rinfos.shares = rs.result[2].split(";")[1];
        rinfos.pool = rs.result[7];
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
        rinfos.cards = cards;
      }else{
        console.log("Erreur, " + rs.error);
      }
    });
    
    s.connect(rig_port, rig_ip);
    s.write('{"id":0,"jsonrpc":"2.0","method":"miner_getstat1"}');
    s.end();
    return rinfos;
  }
}

// END
changeRigInfos();
setInterval(changeRigInfos, config.claymore_remote_interval);
server.listen(80);