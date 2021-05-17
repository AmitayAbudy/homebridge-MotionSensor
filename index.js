var Service, Characteristic;
const request = require('request');

const DEF_INTERVAL = 1000; //1s

const URL = "https://www.oref.org.il/WarningMessages/alert/alerts.json";
const HTTP_METHOD = "GET";
const JSON_RESPONSE = "data";
const HEADERS = {
            "Host": "www.oref.org.il",
            "Connection": "close",
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Referer": "https://www.oref.org.il/12481-he/Pakar.aspx"
         };

module.exports = function (homebridge) {
   Service = homebridge.hap.Service;
   Characteristic = homebridge.hap.Characteristic;
   homebridge.registerAccessory("homebridge-RedAlert", "RedAlert", HttpMotion);
}


function HttpMotion(log, config) {
   this.log = log;

   // url info
   this.url = URL;
   this.http_method = HTTP_METHOD;
   this.json_response = JSON_RESPONSE;
   this.headers = HEADERS;

   this.name = config["name"];
   this.manufacturer = "Amitay Abudy";
   this.model = "RedAlertsLocator";
   this.serial = "AQZ432";
   
   this.update_interval = Number( config["update_interval"] || DEF_INTERVAL );
   this.city = config["city"] || "all";

   // Internal variables
   this.last_state = false;
   this.waiting_response = false;
}

HttpMotion.prototype = {

   updateState: function () {
      //Ensure previous call finished
      if (this.waiting_response) {
         this.log('Avoid updateState as previous response does not arrived yet');
         return;
      }
      this.waiting_response = true;

      var ops = {
         uri:    this.url,
         method: this.http_method,
         headers: this.headers
      };
      request(ops, (error, res, body) => {
         var value = null;

         if (error) {
            this.log('HTTP bad response (' + ops.uri + '): ' + error.message);
         } else if (body === ''){
            error = true;
         } else {
            try {
               var city_alerts = JSON.parse(body)[this.json_response];
               this.log("There are alarms at: " + city_alerts);
            } catch (parseErr) {
               this.log('Error processing received information: ' + parseErr.message);
               error = parseErr;
            }
         }
         if (!error) {
            // Properly set the sensor value
            value = city_alerts.indexOf(this.city)
            value = value !== -1
            // If city is not set
            if (this.city == "all") value = true;

            if (value) this.log("Your city is under attack! Get to the shelters right now!!");
            this.motionService
            .getCharacteristic(Characteristic.MotionDetected).updateValue(value, null, "updateState");

            this.last_state = value;
         }
         this.waiting_response = false;
      });
   },

   getState: function (callback) {
      var state = this.last_state;
      var update = !this.waiting_response;
      var sync = this.update_interval === 0;
      this.log('Call to getState: last_state is "' + state + '", will update state now "' + update + '"' );
      if (update) {
         setImmediate(this.updateState.bind(this));
      }
      callback(null, state);
   },

   getServices: function () {
      this.log("City is set to " + this.city)
      this.informationService = new Service.AccessoryInformation();
      this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial);

      this.motionService = new Service.MotionSensor(this.name);
      this.motionService
         .getCharacteristic(Characteristic.MotionDetected)
         .on('get', this.getState.bind(this));

      if (this.update_interval > 0) {
         this.timer = setInterval(this.updateState.bind(this), this.update_interval);
      }

      return [this.informationService, this.motionService];
   }
};
