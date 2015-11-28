/***********************************************************
 *
 * ARM.Simulator.DevBoard.js
 *  Author:   Torben Könke
 *  Date:     26.11.2015
 *
 * Implements a simple microprocessor development board with
 * a couple of LEDs, buttons, 7-segment display, a simple
 * LCD etc.
 *
 * TODO: Document memory layout. etc.
 * - ARM7-like Processor (16.8 Mhz)
 * - 65kb flash ROM
 * - 4kb RAM
 * - 8 LEDs
 * - 10 Push Buttons (Mapped to Keyboard keys 0-9)
 * - 7-Segment Display
 * - LCD
 * - Interrupt Controller (PICS3C4510B)
 * - UART (16750)
 *
 **********************************************************/

var ARM = ARM || {Simulator:{}};

ARM.Simulator.DevBoard = function(O) {
  /*
   * ARM.Simulator.DevBoard.Constructor
   *  Initializes a new DevBoard Object.
   *
   * @name
   *  a name or id that can be used to identify the DevBoard
   *  instance in event handlers.
   */
  function DevBoard(name) {
    this.name = name;
    this.Reset();
  }

  /*
   * Resets the DevBoard.
   */
  this.Reset = function() {
    var that = this;
    var mem = new ARM.Simulator.Memory([
      { Base: 0x00000000, Size: 0x10000 },
      { Base: 0x00040000, Size: 0x10000 },
      // 'LED IOCTL' Register
      { Base: 0x80000000, Size: 0x00004,
        Read:  function(Address, Type) { that.readLED.call(that, Address, Type); },
        Write: function(Address, Type, Value) { that.writeLED.call(that, Address, Type, Value); }}
    ]);
    var cpu = new ARM.Simulator.Cpu({
      Clockrate: 16.8,
        Memory: mem
    });
    this.VM = new ARM.Simulator.Vm({
      'Cpu':    cpu,
      'Memory': mem
    });
    // Create devices and map into address space.
    var devices = [
      new ARM.Simulator.Device.Video({
        'Base': 0x60000000,
        'Size': 0x00010000
      }),
      new ARM.Simulator.Device.FW({
        'Base': 0xFFFFFFFF
      })
    ];
    for(var i = 0; i < devices.length; i++)
      this.VM.RegisterDevice(devices[i]);
    this.writeLED(null, null, 0);
    this.raiseEvent('LED', this.LEDStatus);
  }

  /*
   * Uploads the specified image to the DevBoard.
   *
   * @Img
   *  The executable image to upload to the DevBoard.
   */
  this.Flash = function(Img) {
    if( Object.prototype.toString.call( Img ) === '[object Array]' )
      this.VM.LoadELF(Img);
    else
      this.VM.LoadImage(Img);
    return this;
  }

  
  /*
   * Executes the uploaded image.
   */
  this.Run = function(n) {
    this.VM.Run(n);
  }

  /*
   * Private Methods and Properties-
   */
  this.LEDstatus = [];
  this.readLED = function(Address, Type) {
  }
   
  this.writeLED = function(Address, Type, Value) {
    // Raise JS event 'GUI' can attach to for rendering the LEDs.
    // 0 = LED n is off.
    // 1 = LED n is on.
    var status = [];
    for(var i = 0; i < 7; i++)
      status.push((Value & (1 << i)) ? 1 : 0);
    this.raiseEvent('LED', status);
    this.LEDStatus = status;
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
    // AFAIK Plain JS Objects can not use EventTarget so we
    // raise all events on window and use the DevBoards name
    // as a means of identifying the instance that raised the
    // event.
     window.dispatchEvent(new CustomEvent(event, {
       detail: { 'devBoard': this.name, 'params': params } })
     );
  }

  DevBoard.call(this, O);
};