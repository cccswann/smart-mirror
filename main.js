/* global __dirname */
/* global process */
const electron = require('electron')
// Child Process for keyword spotter
const {spawn} = require('child_process')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow
// Prevent the monitor from going to sleep.
const powerSaveBlocker = electron.powerSaveBlocker
powerSaveBlocker.start('prevent-display-sleep')

// Launching the mirror in dev mode
const DevelopmentMode = process.argv[2] == "dev";

// Load the smart mirror config
var config;
try {
  config = require(__dirname + "/config.js");
} catch (e) {
  var error = "Unknown Error"

  if (typeof e.code != 'undefined' && e.code == 'MODULE_NOT_FOUND') {
    error = "'config.js' not found. \nPlease ensure that you have created 'config.js' " +
      "in the root of your smart-mirror directory."
  } else if (typeof e.message != 'undefined') {
    console.log(e)
    error = "Syntax Error. \nLooks like there's an error in your config file: " + e.message + '\n' +
    'Protip: You might want to paste your config file into a JavaScript validator like http://jshint.com/'
  }

  console.log("Config Error: ", error)
  app.quit()
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow() {

  // Get the displays and render the mirror on a secondary screen if it exists
  var atomScreen = electron.screen;
  var displays = atomScreen.getAllDisplays();
  var externalDisplay = null;
  for (var i in displays) {
    if (displays[i].bounds.x > 0 || displays[i].bounds.y > 0) {
      externalDisplay = displays[i];
      break;
    }
  }

  var browserWindowOptions = { width: 800, height: 600, icon: 'favicon.ico', kiosk: true, autoHideMenuBar: true, darkTheme: true };
  if (externalDisplay) {
    browserWindowOptions.x = externalDisplay.bounds.x + 50
    browserWindowOptions.y = externalDisplay.bounds.y + 50
  }

  // Create the browser window.
  mainWindow = new BrowserWindow(browserWindowOptions)

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/index.html')

  // Open the DevTools if run with "npm start dev"
  if (DevelopmentMode) {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// Initilize the keyword spotter
var kwsProcess = spawn('node', ['./sonus.js'], {detached: false})
// Handel messages from node
kwsProcess.stderr.on('data', function (data) {
  var message = data.toString()
  console.log("ERROR", message.substring(4))
})

kwsProcess.stdout.on('data', function (data) {
  var message = data.toString()
  if (message.startsWith('!h:')) {
    mainWindow.webContents.send('hotword', true)
  } else if (message.startsWith('!p:')) {
    mainWindow.webContents.send('partial-results', message.substring(4))
  } else if (message.startsWith('!f:')) {
    mainWindow.webContents.send('final-results', message.substring(4))
  } else {
    console.error(message.substring(3))
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  app.quit()
})

// No matter how the app is quit, we should clean up after ourselvs
app.on('will-quit', function () {
  kwsProcess.kill()
})
