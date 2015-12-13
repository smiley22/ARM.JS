/***********************************************************
 *
 * ARM.Simulator.Device.DS1307.js
 *  Author: Torben Könke
 *  Date:   32.12.2015
 *
 * Implements an RTC modeled after the DS1307 Real-Time Clock.
 *
 **********************************************************/

if(!ARM.Simulator.Device)
  ARM.Simulator.Device = {};

ARM.Simulator.Device.DS1307 = function(O) {
  function DS1307(O) {
    this.Base = O.Base;
    this.Name = O.Name;

    if(!localStorage['RTC.Init']) {
      this.initRTC();
      localStorage['RTC.Init'] = 1;
      this.WriteSeconds(0); // Enable oscillator.
    } else {
      if(localStorage['RTC.LastTick']) {
        var dt = new Date().getTime() -
          new Date(parseInt(localStorage['RTC.LastTick'])).getTime();
        if (this.isEnabled()) {
          this.setRTCTime(new Date(this.getRTCTime().getTime() + dt));
          this.WriteSeconds(0);
        }
      }
    }
  }

  this.RegSize  = 8 * 4;
  this.RamSize  = 56;
  this.RegMap = {
    0   : 'Seconds',
    4   : 'Minutes',
    8   : 'Hours',
    12  : 'Day',
    16  : 'Date',
    20  : 'Month',
    24  : 'Year',
    28  : 'Control'
  };
  this.hTimer = null;

  this.OnRegister = function(Vm) {
    Vm.Memory.Map({
      Base:     this.Base,
      Size:     this.RegSize + this.RamSize,
      Read:     this.Read,
      Write:    this.Write,
      Context:  this
    });
    /* keep a reference to vm */
    this.Vm = Vm;
    console.info('DS1307 device mapped into memory at 0x' +
      this.Base.toString(16));
  }
  
  this.OnUnregister = function(Vm) {
    Vm.Memory.Unmap(this.Base);
    console.info('DS1307 device unmapped from memory at 0x' +
      this.Base.toString(16));
  }
  
  this.Read = function(Address, Type) {
    var Offset = Address - this.Base;
    if(Offset < this.RegSize) {
      var Reg = 'RTC.' + this.RegMap[ Offset ];
      return parseInt(localStorage[ Reg ]) & 0xFF;
    } else {
      // User RAM
      var RAM = JSON.parse(localStorage['RTC.RAM']);
      return RAM[ Offset - this.RegSize ];
    }
  }
  
  this.Write = function(Address, Type, Value) {
    var Offset = Address - this.Base;
    if(Offset < this.RegSize) {
      var Reg = this.RegMap[ Offset ];
      localStorage[ Reg ] = Value & 0xFF;
      if(Reg == 'Seconds')
        this.WriteSeconds(Value);
    } else {
      // User RAM
      var RAM = JSON.parse(localStorage['RTC.RAM']);
      RAM[ Offset - this.RegSize ] = Value;
      localStorage['RTC.RAM'] = JSON.stringify(RAM);
    }
  }

  this.WriteSeconds = function(v) {
    // Bit 7 of register 0 (seconds) is the clock halt (CH) bit. When this bit
    // is set to a 1, the oscillator is disabled. When cleared to a 0, the
    // oscillator is enabled.
    if(v & 0x80) {
      // Disable oscillator.
      if(this.hTimer)
        window.clearInterval(this.hTimer);
      this.hTimer = null;
    } else {
      // Enable oscillator.
      var that = this;
      if(!this.hTimer)
        this.hTimer = window.setInterval(function() { that.Tick.call(that); }, 1000);
    }
  }

  this.Tick = function() {
    var newTime = new Date(this.getRTCTime().getTime() + 1000);
    this.setRTCTime(newTime);
//    console.log(newTime);
    localStorage['RTC.LastTick'] = newTime.getTime();
  }

  this.initRTC = function() {
    this.setRTCTime(new Date());
    localStorage['RTC.Config']  = 0;
    var RAM = [];
    for(var i = 0; i < 56; i++)
      RAM.push(0);
    localStorage['RTC.RAM'] = JSON.stringify(RAM);
  }

  this.toBCD = function(n) {
    return (((n / 10) << 4) | (n % 10)) & 0xFF;
  }

  this.fromBCD = function(bcd) {
    if(typeof(bcd) == 'string')
      bcd = parseInt(bcd);
    return ((bcd >> 4) & 0xF) * 10 + (bcd & 0xF)
  }
  
  // Constructs a JavaScript Date instance from the RTC's date and
  // time values.
  this.getRTCTime = function() {
    // Clear CH bit in seconds register.
    var s = this.fromBCD(parseInt(localStorage['RTC.Seconds']) & 0x7F);
    var msk = this.is12HourMode() ? 0x1F : 0x3F;
    var h = this.fromBCD(parseInt(localStorage['RTC.Hours']) & msk);
    if(this.is12HourMode() && this.isPM())
      h = h + 12;
    var m = this.fromBCD(localStorage['RTC.Minutes']),
        d = this.fromBCD(localStorage['RTC.Date']),
       _m = this.fromBCD(localStorage['RTC.Month']) - 1,
        y = this.fromBCD(localStorage['RTC.Year']) + 2000;
    return new Date(y, _m, d, h, m, s);
  }

  // Sets the RTC time to the value specified in the passed JavaScript
  // date instance.
  this.setRTCTime = function(d) {
    var b = parseInt(localStorage['RTC.Seconds']) & 0x80;
    localStorage['RTC.Seconds'] = (b | this.toBCD(d.getSeconds()));
    localStorage['RTC.Minutes'] = this.toBCD(d.getMinutes());
    // The DS1307 can be run in either 12-hour or 24-hour mode. Bit 6 of the
    // hours register is defined as the 12- or 24-hour mode select bit. When high,
    // the 12-hour mode is selected. In the 12-hour mode, bit 5 is the AM/PM bit
    // with logic high being PM. In the 24-hour mode, bit 5 is the second 10 hour
    // bit (20-23 hours).
    b = parseInt(localStorage['RTC.Hours']) & 0x40;
    var h = d.getHours();
    var val = b | this.toBCD(h);
    if(b) {
      var pm = (h > 11 ? 1 : 0) << 5;
      if(pm)
        h = h - 12;
      val = b | pm | this.toBCD(h);
    }
    localStorage['RTC.Hours']   = val;
    localStorage['RTC.Day']     = this.toBCD(d.getDay() + 1);
    localStorage['RTC.Date']    = this.toBCD(d.getDate());
    localStorage['RTC.Month']   = this.toBCD(d.getMonth() + 1);
    localStorage['RTC.Year']    = this.toBCD(d.getFullYear() % 100);
  }

  this.is12HourMode = function() {
    return (parseInt(localStorage['RTC.Hours']) >> 6) & 0x01;
  }

  this.isPM = function() {
    return (parseInt(localStorage['RTC.Hours']) >> 5) & 0x01;
  }

  this.isEnabled = function() {
    return !((parseInt(localStorage['RTC.Seconds']) >> 7) & 0x01);
  }

 /*
  * Raises a JS event on the window object.
  *
  * @event
  *  The name of the event to raise.
  * @params
  *  The parameters to pass along with the event in the
  *  'details' field of CustomEvent.
  */
  this.raiseEvent = function(event, params) {
     window.dispatchEvent(new CustomEvent(event, {
       detail: { 'devBoard': this.BoardName, 'params': params } })
     );
  }

  DS1307.call(this, O);
}
